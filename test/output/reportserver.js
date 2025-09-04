
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));

// WebSocket connection handling
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        ws.send(`Echo: ${message}`);
    });

    ws.on('close', () => {
        server.close(() => {
            console.log('Terminated report server')
            process.exit(0);
        });
    });
});

server.listen(3000, () => {
    console.log('You can view the report server at http://localhost:3000');
});
