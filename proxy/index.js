#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const tls = require('tls');

const port = Number(process.env.PROXY_PORT || 7015);
const renderer = new URL(process.env.RENDERER_URL || 'http://127.0.0.1:3000');
const secureContext = tls.createSecureContext({
  cert: fs.readFileSync(process.env.TLS_CERT),
  key: fs.readFileSync(process.env.TLS_KEY)
});

function rendererPath(targetUrl) {
  return `/${targetUrl}`;
}

function forwardToRenderer(targetUrl, clientRequest, clientResponse) {
  console.log(`[proxy] ${targetUrl}`);

  const upstream = http.request({
    hostname: renderer.hostname,
    port: renderer.port,
    method: clientRequest.method,
    path: rendererPath(targetUrl),
    headers: clientRequest.headers
  }, (response) => {
    clientResponse.writeHead(response.statusCode, response.headers);
    response.pipe(clientResponse);
  });

  upstream.on('error', (error) => {
    console.error('[proxy] Error al conectar con el renderer:', error.message);
    if (!clientResponse.headersSent) {
      clientResponse.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    clientResponse.end('Error al conectar con el renderer');
  });

  clientRequest.pipe(upstream);
}

const plainServer = http.createServer((request, response) => {
  const targetUrl = /^https?:\/\//i.test(request.url)
    ? request.url
    : `http://${request.headers.host}${request.url}`;
  forwardToRenderer(targetUrl, request, response);
});

const decryptedServer = http.createServer((request, response) => {
  const targetUrl = `https://${request.headers.host}${request.url}`;
  forwardToRenderer(targetUrl, request, response);
});

plainServer.on('connect', (request, socket, head) => {
  socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

  if (head.length > 0) {
    socket.unshift(head);
  }

  const secureSocket = new tls.TLSSocket(socket, {
    isServer: true,
    secureContext
  });

  secureSocket.on('error', (error) => {
    console.error('[proxy] Error TLS:', error.message);
    secureSocket.destroy();
  });

  decryptedServer.emit('connection', secureSocket);
});

plainServer.listen(port, '127.0.0.1', () => {
  console.log(`[proxy] Escuchando en 127.0.0.1:${port}`);
});
