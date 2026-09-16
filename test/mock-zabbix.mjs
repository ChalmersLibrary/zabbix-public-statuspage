'use strict';

/**
 * A stand-in for the Zabbix API, so the statuspage can be developed and tested
 * without touching the real one.
 *
 * Hostnames are taken from services.json, so the fixtures stay valid when the
 * configured services change. The data deliberately includes the awkward cases
 * that have caused bugs before: a trigger covering several hosts, an event from
 * a host that is not configured, a resolved problem whose recovery event is
 * missing, an event with no hosts at all, an announcement that has expired, and
 * a maintenance on a real host group that must never be published.
 *
 * Run it on its own with `npm run mock`, or together with the app through
 * `npm run dev:mock`.
 */

import http from 'node:http';
import servicesDefinition from '../services.json' with { type: "json" };

const configured_hosts = servicesDefinition.segments.flatMap((segment) =>
    segment.services.map((service) => service.zabbix_host));

const announcement_group = servicesDefinition.zabbix_announcement_hostgroup ?? "Statuspage announcements";

/**
 * Build the canned responses.
 * @param {Object} options `ok` reports every service as healthy.
 * @returns Responses keyed by API method.
 */
function fixtures ({ ok = false } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const problem = ok ? "0" : "1";

    // Named so the intent survives a change to services.json.
    const [ first, second, third, fourth ] = configured_hosts;

    const hostgroups = [
        { groupid: "99", name: announcement_group },
        { groupid: "19", name: "Applications" }
    ];

    const triggers = [
        {
            triggerid: "1", description: "Web scenario failed",
            priority: "4", status: "0", value: problem,
            hosts: [ { host: first, description: "The first configured service." } ],
            hostgroups: [ { groupid: "19" } ]
        },
        {
            triggerid: "2", description: "Certificate expires soon",
            priority: "2", status: "0", value: "0",
            hosts: [ { host: second, description: "" } ],
            hostgroups: [ { groupid: "19" } ]
        },
        {
            // Covers two hosts. The description shown for `fourth` must be its
            // own, not the one belonging to `third`.
            triggerid: "3", description: "Shared cluster check",
            priority: "3", status: "0", value: problem,
            hosts: [
                { host: third, description: "Third service, listed first on the trigger." },
                { host: fourth, description: "Fourth service, listed second." }
            ],
            hostgroups: [ { groupid: "19" } ]
        }
    ].filter((trigger) => trigger.hosts.every((host) => host.host));

    const events = [
        // Resolved problem on a configured host, with its recovery event.
        { eventid: "100", r_eventid: "101", clock: String(now - 7200), value: "1",
          severity: "4", name: "Web scenario failed", hosts: [ { host: first } ] },
        { eventid: "101", r_eventid: "0", clock: String(now - 3600), value: "0",
          severity: "4", name: "Web scenario failed", hosts: [ { host: first } ] },
        // Resolved problem on a host that is not in services.json.
        { eventid: "200", r_eventid: "201", clock: String(now - 5400), value: "1",
          severity: "2", name: "Problem on an unconfigured host", hosts: [ { host: "ghost.example.org" } ] },
        { eventid: "201", r_eventid: "0", clock: String(now - 5000), value: "0",
          severity: "2", name: "Problem on an unconfigured host", hosts: [ { host: "ghost.example.org" } ] },
        // Recovery event falls outside the fetched window.
        { eventid: "300", r_eventid: "999", clock: String(now - 4000), value: "1",
          severity: "3", name: "Recovery event missing", hosts: [ { host: second } ] },
        // No hosts at all.
        { eventid: "400", r_eventid: "401", clock: String(now - 3000), value: "1",
          severity: "1", name: "Event without hosts", hosts: [] }
    ];

    const maintenances = [
        // Announcements, in the dedicated group. Deliberately out of order.
        { maintenanceid: "5", name: "Fibre cable switch",
          description: "No network in the building while the work is going on.",
          active_since: String(now + 86400), active_till: String(now + 172800),
          timeperiods: [ { timeperiod_type: "0" } ], hostgroups: [ { groupid: "99" } ] },
        { maintenanceid: "6", name: "Weekly service window",
          description: "Recurring announcement, which must still be published.",
          active_since: String(now + 3600), active_till: String(now + 10800),
          timeperiods: [ { timeperiod_type: "3" } ], hostgroups: [ { groupid: "99" } ] },
        { maintenanceid: "7", name: "Announcement that has expired",
          description: "Ran last week and must not be shown.",
          active_since: String(now - 172800), active_till: String(now - 86400),
          timeperiods: [ { timeperiod_type: "0" } ], hostgroups: [ { groupid: "99" } ] },
        // Suppression on a real host group. Never public, one time only or not.
        { maintenanceid: "8", name: "Internal patching, must not be published",
          description: "If this appears on the page, the group scoping is broken.",
          active_since: String(now), active_till: String(now + 7200),
          timeperiods: [ { timeperiod_type: "0" } ], hostgroups: [ { groupid: "19" } ] }
    ];

    return { hostgroups, triggers, events, maintenances };
}

/**
 * Answer one JSON-RPC request the way the Zabbix API would.
 * @param {Object} request Parsed request body.
 * @param {Object} data From fixtures().
 * @returns The `result` value.
 */
function respond (request, data) {
    const params = request.params ?? {};

    switch (request.method) {
        case 'hostgroup.get': {
            const names = params.filter?.name ?? [];
            return data.hostgroups.filter((group) => names.includes(group.name));
        }
        case 'trigger.get':
            return data.triggers;
        case 'event.get':
            return data.events;
        case 'maintenance.get': {
            // An absent groupids means no filter, which is exactly the mistake
            // the app guards against, so reproduce it faithfully.
            const groupids = params.groupids ?? null;

            return data.maintenances.filter((maintenance) => groupids === null
                || maintenance.hostgroups.some((group) => groupids.includes(group.groupid)));
        }
        default:
            return [];
    }
}

/**
 * Start the mock. The default port of 0 lets the system pick a free one, which
 * is what the in-process dev server wants; running standalone asks for a fixed
 * port instead, so the url can be written down in advance.
 * @param {Object} options `ok` reports every service as healthy.
 * @returns The server and the url it is listening on.
 */
export function startMock ({ ok = false, port = 0 } = {}) {
    const data = fixtures({ ok });

    const server = http.createServer((req, res) => {
        let body = '';

        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            let request;

            try {
                request = JSON.parse(body);
            }
            catch {
                res.writeHead(400).end();
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                jsonrpc: "2.0",
                result: respond(request, data),
                id: request.id
            }));
        });
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
        });
    });
}

// Started directly rather than imported.
if (import.meta.url === `file://${process.argv[1]}`) {
    const ok = process.argv.includes('--ok');
    const { url } = await startMock({ ok, port: Number(process.env.MOCK_PORT) || 3002 });

    console.log(`Mock Zabbix API on ${url}, reporting ${ok ? 'everything healthy' : 'problems'}.`);
    console.log(`Point the app at it with ZABBIX_API_URL=${url}`);
}
