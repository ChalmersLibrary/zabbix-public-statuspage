'use strict';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';

const api_url = process.env.ZABBIX_API_URL;
const api_token = process.env.ZABBIX_API_TOKEN;


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
