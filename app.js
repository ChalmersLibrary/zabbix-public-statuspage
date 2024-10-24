import express from 'express';
import { readFile } from 'fs';
import { fetchEvents, fetchTriggers } from './zabbixapi.mjs';

// Load services to display
let services;

readFile('services.json', 'utf8', function (err, data) {
    if (err) throw err;
    services = JSON.parse(data);
});

const app = express();
const port = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Define a route for the root URL
app.get('/', async (req, res) => {
    services.segments.forEach(async (segment) => {
        segment.services.forEach(async (service) => {
            await fetchTriggers(service.zabbix_host, services.zabbix_trigger_tags).then(result => {
                service.triggers = result.result;
                if (result.result && result.result[0] && result.result[0].hosts && result.result[0].hosts[0].description) {
                    service.description = result.result[0].hosts[0].description;
                }
            });
        });
    });

    const currentDate = new Date(); 
    const lastWeekDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    fetchEvents(lastWeekDate, services.zabbix_trigger_tags).then(result => {
        services.history = result.result;
    });

    // console.log(JSON.stringify(services));

    res.render('index', { data: services });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
