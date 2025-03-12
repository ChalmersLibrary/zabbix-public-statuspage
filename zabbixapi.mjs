'use strict';

import fetch from 'node-fetch';

const api_url = process.env.ZABBIX_API_URL;
const api_token = process.env.ZABBIX_API_TOKEN;

/**
 * Fetch all triggers from Zabbix API matching tags.
 * @param {Array} tags 
 * @returns JSON result.
 */
export async function fetchAllTriggers (tags) {
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
                    "tags": tags,
                    "maintenance": false,
                    "output": [
                        "triggerid",
                        "description",
                        "priority",
                        "status",
                        "value"
                    ],
                    "selectHosts": [ "host", "description" ],
                    "selectHostGroups": [ "groupid" ]
                },
                "id": 1
            })
        }); 

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        json = await response.json();

        if (json.error) {
            throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
        }
    }
    catch (error) {
        throw new Error(error);
    }

    return json;
}

/**
 * Fetch triggers from Zabbix matching hostname and tags.
 * @param {String} host 
 * @param {Array} tags 
 * @returns JSON result.
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

        if (json.error) {
            throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
        }
    }
    catch (error) {
        throw new Error(error);
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

        if (json.error) {
            throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
        }
    }
    catch (error) {
        throw new Error(error);
    }

    return json;
}

/**
 * Fetch maintenance from Zabbix API for specified groupids.
 * @param {Array} groupids 
 * @returns JSON result.
 */
export async function fetchMaintenance (groupids) {
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
                "method": "maintenance.get",
                "params": {
                    "groupids": groupids,
                    "output": "extend",
                    "selectHostGroups": "extend",
                    "selectTimeperiods": "extend",
                    "selectTags": "extend"
                },
                "id": 1
            })
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        json = await response.json();

        if (json.error) {
            throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
        }
    }
    catch (error) {
        throw new Error(error);
    }

    return json;
}