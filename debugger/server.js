'use strict';

const { createServer } = require('http');
const frontend = require('fs').readFileSync(__dirname + '/index.html');
let clientId = 0;
let started = false;
let paused = false;
let closed = false;
let stepByStep = false;
let continueExecution = undefined;
const clients = {};

module.exports = port => {
    let server;
    return {
        start({ onStart, onResume }) {
            server = open(port, onStart, onResume);
        },
        send(data) {
            Object.keys(clients)
                .forEach(clientId =>
                    clients[clientId].write('data: ' + JSON.stringify(data) + '\n\n')
                );
        },
        finish() {
            closed = true;
            console.log('Finishing debugger...');
            Object.keys(clients)
                .forEach(clientId =>
                    clients[clientId].end('event: close-app\ndata: \n\n')
                );
            server.setTimeout(1);
            server.close(() => console.log('Puerh server closed'));
        },
        isPaused() {
            return paused;
        },
        isStepByStep() {
            return stepByStep;
        },
        confirmationSignal(something) {
            paused = true;
            console.log('waiting for', something);
            // we could send some event to a client informing about awaiting task
            return new Promise(resolve => {
                continueExecution = resolve;
            });
        }
    };
};

function open(port, startCallback, resumeCallback) {
    const server = createServer((req, res) => {
        if (closed) {
            console.log('We are closed, come back later');
            res.writeHead(501, {
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            return;
        }

        // console.log('here', req.method, req.url);

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

        if (req.url === '/start' && req.method === 'POST') {
            withJsonBody(req, data => {
                if (!started) {
                    started = true;
                    paused = data.paused;
                    const { state, action } = data;
                    console.log('Application started', paused ? '(in paused mode)' : '(live)');
                    console.log('Checkpoint is', state, action);
                    process.nextTick(() => startCallback(state, action));
                }

                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*'
                });
                res.end();
            });

            return;
        }

        if (req.url === '/pause' && req.method === 'POST') {
            paused = true;
            console.log('paused');
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            return;
        }

        if (req.url === '/continue' && req.method === 'POST') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*'
            });
            res.end();
            if (typeof continueExecution === 'function') {
                console.log('continue');
                paused = false;
                stepByStep = true;
                continueExecution();
                continueExecution = undefined;
            } else {
                console.log('nobody is waiting');
            }
            return;
        }

        if (req.url === '/resume' && req.method === 'POST') {
            withJsonBody(req, data => {
                const { state, action } = data;
                paused = false;
                stepByStep = false;
                console.log('resumed');
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*'
                });
                res.end();
                if (state) {
                    resumeCallback(state, action);
                }
            });
            return;
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Headers': 'Content-Type',
                // 'Allow': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Max-Age': '900'
            });
            res.end();
            return;
        }

    });

    server.listen(port);
    // .listen(process.env.DEBUG_PORT || 9898);

    // server.on('listening', () => console.log('Puerh server listening'));
    return server;
}

function withJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        let data;
        try {
            data = JSON.parse(body);
        } catch (error) {
            console.error(error);
            return;
        }
        callback(data);
    });
}
