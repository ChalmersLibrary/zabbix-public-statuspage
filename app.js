'use strict';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { readFile } from 'fs';
import { fetchTriggers } from './zabbixapi.mjs';

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
    services.segments.forEach((segment) => {
        segment.services.forEach((service) => {
            fetchTriggers(service.zabbix_host, services.zabbix_trigger_tags).then(result => {
                service.triggers = result.result;
                console.log(`Zabbix result for host ${service.zabbix_host}: ${JSON.stringify(result.result)}`);
                if (result.result && result.result[0] && result.result[0].hosts && result.result[0].hosts[0].description) {
                    service.description = result.result[0].hosts[0].description;
                }
            });
        });
    });

    res.render('index', { title: 'Current service status', data: services });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
