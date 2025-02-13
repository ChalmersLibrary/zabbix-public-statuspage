import express from 'express';
import { readFile, readFileSync } from 'fs';
import { fetchEvents, fetchTriggers } from './zabbixapi.mjs';
import services from './services.json' with { type: "json" };

const app = express();
const port = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Serve static files from the "public" directory
app.use(express.static('public'));

// Define a route for the root URL
app.get('/', async (req, res) => {
    let summaryHosts = 0;
    let summaryHostsWithOK = 0;
    let summaryHostsWithProblem = 0;
    let hosts = [];
    const currentDate = new Date(); 
    const backHistoryDate = new Date(currentDate.getTime() - 3 * 24 * 60 * 60 * 1000);

    try 
    {
        services.compact = req.query.compact == "1";

        for (var segment of services.segments) 
        {
            for (var service of segment.services)
            {
                const triggers = await fetchTriggers(service.zabbix_host, services.zabbix_trigger_tags);
                service.triggers = triggers.result;

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
                    "key": service.zabbix_host,
                    "display_host": service.display_host ? service.display_host : service.zabbix_host,
                    "display": service.display_host ? service.display_host : service.zabbix_host,
                    "description": service.description,
                    "triggers": service.triggers
                });

                const events = await fetchEvents(backHistoryDate, services.zabbix_trigger_tags);
                services.history = events.result;
            }
        }

        services.hosts = hosts;
    }
    catch (error) {
        console.error(error);
        res.status(500);
        return res.render('error', { error: error.message });
    }

    return res.render('index', { data: services, currentDate, summary: { hosts: summaryHosts, ok: summaryHostsWithOK, problem: summaryHostsWithProblem } });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
