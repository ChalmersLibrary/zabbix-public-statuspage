'use strict';

/**
 * Run the statuspage against the mock Zabbix API, for looking at the page in
 * states that are awkward to produce against a real installation.
 *
 *   npm run dev:mock             services reporting problems
 *   npm run dev:mock -- --ok     everything healthy
 *
 * The mock runs inside this process, so it cannot be stopped on its own. To see
 * the page lose contact with Zabbix, run the two halves separately instead:
 *
 *   npm run mock
 *   ZABBIX_API_URL=http://127.0.0.1:3002 CACHE_TTL_SECONDS=5 npm run dev
 *
 * then load the page and stop the mock. Starting the app with nothing listening
 * gives the error page; stopping the mock after a page load gives the stale
 * notice, since a snapshot is already cached.
 *
 * The environment is set before app.js is imported, and .env never overrides an
 * existing variable, so the real Zabbix credentials are left alone. A port is
 * chosen that will not collide with a dev server already running from .env.
 */

import net from 'node:net';

import { startMock } from './mock-zabbix.mjs';

/**
 * Report whether something is already listening, so a clash produces a useful
 * sentence rather than a bare EADDRINUSE stack from deep inside express.
 * @param {Number} port
 * @returns True when the port is free.
 */
function isFree (port) {
    return new Promise((resolve) => {
        const probe = net.createServer();

        probe.once('error', () => resolve(false));
        probe.once('listening', () => probe.close(() => resolve(true)));
        // No host, so this binds the same wildcard address express does. Probing
        // 127.0.0.1 would succeed even when something already holds :::<port>.
        probe.listen(port);
    });
}

const ok = process.argv.includes('--ok');
const { url } = await startMock({ ok });

process.env.ZABBIX_API_URL = url;
process.env.ZABBIX_API_TOKEN = 'mock';
process.env.PORT = process.env.PORT || '3001';

process.env.CACHE_TTL_SECONDS = process.env.CACHE_TTL_SECONDS || '5';

if (!await isFree(Number(process.env.PORT))) {
    console.error(`Port ${process.env.PORT} is already in use. Stop whatever is on it, `
        + `or choose another with PORT=3005 npm run dev:mock`);
    process.exit(1);
}

console.log(`Mock Zabbix API on ${url}, reporting ${ok ? 'everything healthy' : 'problems'}.`);

await import('../app.js');
