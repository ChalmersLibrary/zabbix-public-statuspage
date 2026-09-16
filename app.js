import express from 'express';
import { fetchEvents, fetchAllTriggers, fetchMaintenance } from './zabbixapi.mjs';
import servicesDefinition from './services.json' with { type: "json" };

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

// Serve static files from the "public" directory
app.use(express.static('public'));

/**
 * Collect the current status of every configured service from Zabbix.
 * @returns Services with triggers and history, plus summary counts.
 */
async function fetchStatus () {
    let summaryHosts = 0;
    let summaryHostsWithOK = 0;
    let summaryHostsWithProblem = 0;
    let hosts = [];
    let all_hostgroups = [];
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

    // Index triggers by hostname once, instead of rescanning them per service.
    const triggers_by_host = new Map();

    for (const trigger of all_triggers.result) {
        for (const host of trigger.hosts) {
            if (!triggers_by_host.has(host.host)) {
                triggers_by_host.set(host.host, []);
            }

            triggers_by_host.get(host.host).push(trigger);
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

            if (service.triggers && service.triggers[0] && service.triggers[0].hosts && service.triggers[0].hosts[0].description) {
                service.description = service.triggers[0].hosts[0].description;
            }

            hosts.push({ 
                "zabbix_host": service.zabbix_host,
                "display_host": service.display_host ? service.display_host : service.zabbix_host,
                "description": service.description,
                "triggers": service.triggers
            });

            if (service.triggers && service.triggers[0] && service.triggers[0].hostgroups) {
                all_hostgroups.push(service.triggers[0].hostgroups[0].groupid);
            }
        }
    }

    services.hosts = hosts;
    services.hostgroups = [...new Set(all_hostgroups)];
    services.upcoming = await fetchMaintenance(services.hostgroups);

    return {
        services,
        currentDate,
        summary: { hosts: summaryHosts, ok: summaryHostsWithOK, problem: summaryHostsWithProblem }
    };
}

/**
 * Return a recently fetched status, or fetch a new one. Concurrent callers
 * share a single fetch, so a burst of visitors still makes one set of calls.
 * @returns Status as returned by fetchStatus.
 */
function getStatus () {
    if (cached_status && Date.now() - cached_status.fetchedAt < cache_ttl_ms) {
        return Promise.resolve(cached_status.status);
    }

    if (!pending_status) {
        pending_status = fetchStatus()
            .then((status) => {
                cached_status = { status, fetchedAt: Date.now() };
                return status;
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

    return res.render('index', { data, currentDate: status.currentDate, summary: status.summary });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
