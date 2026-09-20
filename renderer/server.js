#!/usr/bin/env node
'use strict';

const prerender = require('prerender');
const server = prerender({
  followRedirects: true,
  chromeLocation: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  chromeFlags: [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--hide-scrollbars',
    '--disable-dev-shm-usage'
  ],
  pageDoneCheckInterval: 1000,
  waitAfterLastRequest: 1000,
  // Java abandona la lectura del proxy a los 15 segundos.
  pageLoadTimeout: 10000,
  workers: 1,
  enableServiceWorker: true
});

server.use(prerender.sendPrerenderHeader());
server.use(prerender.removeScriptTags());
server.use(prerender.httpHeaders());
server.start();
