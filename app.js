// Loads .env when present. Existing environment variables win, so a container
// that gets them from docker-compose is unaffected.
import 'dotenv/config';

import express from 'express';
import { fetchEvents, fetchAllTriggers, fetchMaintenance, fetchHostGroupIds } from './zabbixapi.mjs';
import servicesDefinition from './services.json' with { type: "json" };
import packageInfo from './package.json' with { type: "json" };

const app = express();
const port = process.env.PORT || 3000;

// How long a fetched status is reused before going back to Zabbix. The page
// reloads itself every minute, so without this the number of API calls grows
// with the number of visitors.
const cache_ttl_ms = (Number(process.env.CACHE_TTL_SECONDS) || 30) * 1000;

let cached_status = null;
let pending_status = null;

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Read straight from package.json rather than from the npm_package_* environment
// variables, which only exist when the app is started through an npm script.
app.locals.appInfo = { name: packageInfo.name, version: packageInfo.version };

// Serve static files from the "public" directory
app.use(express.static('public'));

/**
 * Fetch the announcements shown under "Planned service". These live in a host
 * group of their own that deliberately contains no hosts, so that announcing
 * something never suppresses monitoring, and suppressing monitoring never
 * announces anything.
 * @param {String} group_name 
 * @returns Array of maintenance objects, empty when not configured.
 */
async function fetchAnnouncements (group_name) {
    if (!group_name) {
        return [];
    }

    const groupids = await fetchHostGroupIds([ group_name ]);

    // Without this guard an empty list would be sent as "no filter", which
    // would publish every maintenance in Zabbix.
    if (!groupids.length) {
        console.warn(`Announcement host group "${group_name}" was not found in Zabbix.`);
        return [];
    }

    const announcements = await fetchMaintenance(groupids);
    const now = Math.floor(Date.now() / 1000);

    // Zabbix keeps a maintenance entry until it is deleted, so drop the ones
    // that have already run their course and show what is left oldest first.
    return announcements
        .filter((x) => Number(x.active_till) > now)
        .sort((a, b) => Number(a.active_since) - Number(b.active_since));
}

/**
 * Collect the current status of every configured service from Zabbix.
 * @returns Services with triggers and history, plus summary counts.
 */
async function fetchStatus () {
    let summaryHosts = 0;
    let summaryHostsWithOK = 0;
    let summaryHostsWithProblem = 0;
    let hosts = [];
    const currentDate = new Date(); 
    const backHistoryDate = new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Create a deep copy of the services object, so that the collected state is
    // never written back onto the imported definition.
    let services = structuredClone(servicesDefinition);

    services.hostgroups = [];

    // Triggers and events do not depend on each other, so fetch them together.
    const [all_triggers, all_events] = await Promise.all([
        fetchAllTriggers(services.zabbix_trigger_tags),
        fetchEvents(backHistoryDate, services.zabbix_trigger_tags)
    ]);

    services.history = all_events.result;

    // Index triggers and host descriptions by hostname once, instead of
    // rescanning them per service.
    const triggers_by_host = new Map();
    const description_by_host = new Map();

    for (const trigger of all_triggers.result) {
        for (const host of trigger.hosts) {
            if (!triggers_by_host.has(host.host)) {
                triggers_by_host.set(host.host, []);
            }

            triggers_by_host.get(host.host).push(trigger);

            if (host.description && !description_by_host.has(host.host)) {
                description_by_host.set(host.host, host.description);
            }
        }
    }

    for (var segment of services.segments) 
    {
        for (var service of segment.services)
        {
            service.triggers = triggers_by_host.get(service.zabbix_host) ?? [];

            // DEBUG
            /* if (service.triggers[0].triggerid == "24294") {
                service.triggers[0].value = "1";
                service.triggers[0].priority = "3";
            } */

            if (service.triggers?.some((x) => x.value == "1")) {
                summaryHostsWithProblem++;
            }
            else {
                summaryHostsWithOK++;
            }

            summaryHosts++;

            // A trigger can cover several hosts, so take the description of the
            // host this service points at, not whichever host happens to be first.
            service.description = description_by_host.get(service.zabbix_host) ?? service.description;

            hosts.push({ 
                "zabbix_host": service.zabbix_host,
                "display_host": service.display_host ? service.display_host : service.zabbix_host,
                "description": service.description,
                "triggers": service.triggers
            });

        }
    }

    services.hosts = hosts;
    services.upcoming = await fetchAnnouncements(services.zabbix_announcement_hostgroup);

    return {
        services,
        currentDate,
        summary: { hosts: summaryHosts, ok: summaryHostsWithOK, problem: summaryHostsWithProblem }
    };
}

/**
 * Return a recently fetched status, or fetch a new one. Concurrent callers
 * share a single fetch, so a burst of visitors still makes one set of calls.
 * If Zabbix cannot be reached the last good snapshot is served instead, marked
 * as stale, so that a planned service announcement stays readable during the
 * very outage it describes.
 * @returns Status as returned by fetchStatus, with a stale flag.
 */
function getStatus () {
    if (cached_status && Date.now() - cached_status.fetchedAt < cache_ttl_ms) {
        return Promise.resolve({ ...cached_status.status, stale: false });
    }

    if (!pending_status) {
        pending_status = fetchStatus()
            .then((status) => {
                cached_status = { status, fetchedAt: Date.now() };
                return { ...status, stale: false };
            })
            .catch((error) => {
                if (!cached_status) {
                    throw error;
                }

                console.error('Falling back to the last good status:', error);

                return { ...cached_status.status, stale: true };
            })
            .finally(() => {
                pending_status = null;
            });
    }

    return pending_status;
}

// Define a route for the root URL
app.get('/', async (req, res) => {
    let status;

    try {
        status = await getStatus();
    }
    catch (error) {
        console.error(error);
        res.status(500);
        return res.render('error', { error: error.message });
    }

    // Only the view flags differ per request, the rest is shared and read-only.
    const data = { ...status.services, compact: req.query.compact == "1", micro: req.query.micro == "1" };

    return res.render('index', { data, currentDate: status.currentDate, summary: status.summary, stale: status.stale });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
