'use strict';

// Read on use rather than at import time, so the values are picked up no matter
// when the environment is loaded.
const api_url = () => process.env.ZABBIX_API_URL;
const api_token = () => process.env.ZABBIX_API_TOKEN;

/**
 * Fetch all triggers from Zabbix API matching tags.
 * @param {Array} tags 
 * @returns JSON result.
 */
export async function fetchAllTriggers (tags) {
    const response = await fetch(api_url(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api_token()}`
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

    const json = await response.json();

    if (json.error) {
        throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
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
    const response = await fetch(api_url(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api_token()}`
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

    const json = await response.json();

    if (json.error) {
        throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
    }

    return json;
}

/**
 * Look up host group ids by their exact names.
 * @param {Array} names 
 * @returns Array of groupids, empty when no name matched.
 */
export async function fetchHostGroupIds (names) {
    const response = await fetch(api_url(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api_token()}`
        },
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "method": "hostgroup.get",
            "params": {
                "output": [ "groupid", "name" ],
                "filter": { "name": names }
            },
            "id": 1
        })
    });

    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();

    if (json.error) {
        throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
    }

    return json.result.map((x) => x.groupid);
}

/**
 * Fetch maintenance from Zabbix API for specified groupids.
 * @param {Array} groupids 
 * @returns JSON result.
 */
export async function fetchMaintenance (groupids) {
    const response = await fetch(api_url(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${api_token()}`
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

    const json = await response.json();

    if (json.error) {
        throw new Error(`Response from API: ${json.error.message} ${json.error.data}`);
    }

    return json.result;
}