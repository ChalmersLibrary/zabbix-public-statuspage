'use strict';

import fetch from 'node-fetch';

const api_url = process.env.ZABBIX_API_URL;
const api_token = process.env.ZABBIX_API_TOKEN;

/**
 * Fetch triggers from Zabbix matching hostname and tags.
 * @param {*} host 
 * @param {*} tags 
 * @returns 
 */
export async function fetchTriggers (host, tags) {
    let json;

    try {
        const response = await fetch(api_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_token}`
            },
            body: JSON.stringify({
                "jsonrpc": "2.0",
                "method": "trigger.get",
                "params": {
                    "host": host,
                    "tags": tags,
                    "output": [
                        "triggerid",
                        "description",
                        "priority",
                        "status",
                        "value"
                    ],
                    "selectHosts": [ "host", "description" ]
                },
                "id": 1
            })
        }); 

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        json = await response.json(); 
    }
    catch (error) {
        console.error(`Error fetching data: ${error.message}`); 
    }

    return json;
}

/**
 * Fetch events from Zabbix API from specified time and with tags.
 * @param {Date} time_from 
 * @param {Array} tags 
 * @returns 
 */
export async function fetchEvents (time_from, tags) {
    let json;

    try {
        const response = await fetch(api_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_token}`
            },
            body: JSON.stringify({
                "jsonrpc": "2.0",
                "method": "event.get",
                "params": {
                    "tags": tags,
                    "output": [
                        "eventid",
                        "r_eventid",
                        "clock",
                        "value",
                        "severity",
                        "name"
                    ],
                    "time_from": parseInt(time_from.getTime() / 1000),
                    "sortfield": ["clock", "eventid"],
                    "sortorder": "DESC",
                    "selectHosts": [ "host", "description" ]
                },
                "id": 1
            })
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        json = await response.json();
        // console.log(`EVENTS: ${JSON.stringify(json)}`);
    }
    catch (error) {
        console.error(`Error fetching data: ${error.message}`); 
    }

    return json;
}
