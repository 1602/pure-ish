'use strict';

const { createServer } = require('http');
const frontend = require('fs').readFileSync(__dirname + '/index.html');
let clientId = 0;
const clients = {};

module.exports = port => {
    const server = open(port);
    return {
        send(data) {
            Object.keys(clients)
                .forEach(clientId =>
                    clients[clientId].write('data: ' + JSON.stringify(data) + '\n\n')
                );
        },
        finish() {
            Object.keys(clients)
                .forEach(clientId =>
                    clients[clientId].end('\n')
                );
            server.close();
        },
    };
};

function open(port) {
    const server = createServer((req, res) => {
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(frontend);
            return;
        }

        if (req.url === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            res.write('\n');

            (function(clientId) {
                clients[clientId] = res;
                req.on('close', () => {
                    delete clients[clientId];
                });
            })(clientId += 1);

            return;
        }

    });

    server.listen(port);
    // .listen(process.env.DEBUG_PORT || 9898);

    return server;
}


