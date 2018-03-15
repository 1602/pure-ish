'use strict';

const fs = require('fs');
const debuggerServer = require('./debugger/server.js');
const spawn = require('child_process').spawn;
const uuid = require('uuid');

/* @flow */

/*::
export type Cmd = {
    object: 'command',
    task: any,
    message: string
};

export type Sub = {
    object: 'subscription'
};
*/

module.exports = {
    program,
    noCmd,
};

const intervalTimers = {};
let intervalHandlers = {};
let shutdownHandlers = [];
let update = {};
let model = {};
let subscriptions /*: ?function */ = null;

let debug = null;

if (process.env.DEBUGGER_PORT) {
    debug = debuggerServer(parseInt(process.env.DEBUGGER_PORT, 10));

    // spawn('open', ['http://localhost:' + process.env.DEBUGGER_PORT + '/']);
}

module.exports.debug = debug;

function trackUpdate(rayId, msg, state, cmd) {
    if (debug) {
        debug.send({ event: 'update', rayId, msg, state, cmd });
    }
}

function program(data, definitions /*: { init: function, update: any, subscriptions: function } */) {
    update = definitions.update;
    const [m, cmd] = definitions.init(data);
    if (process.env.PERSIST_STORE) {
        try {
            model = JSON.parse(fs.readFileSync(process.env.PERSIST_STORE).toString());
        } catch (e) {
            model = m;
            execute(cmd);
        }
    } else {
        model = m;
        execute(cmd);
    }
    subscriptions = definitions.subscriptions;
    registerSubscriptions(definitions.subscriptions(model));

    return {
        finish: () => {
            stopApplication();
            stopTimers();
            stopDebugger();
        },
    };
}

function stopApplication() {
    shutdownHandlers.forEach(command => startRay(command));
}

function stopTimers() {
    Object
        .keys(intervalTimers)
        .forEach(key => {
            const timer /*: ?IntervalID */ = intervalTimers[key];
            if (timer !== null && timer !== undefined) {
                clearInterval(timer);
            }
        });
}


function stopDebugger() {
    if (debug) {
        debug.finish();
    }
}


function noCmd() {
    return { object: 'command', task: null, message: '' };
}


function registerSubscriptions(s) {
    intervalHandlers = {};
    shutdownHandlers = [];
    register(s);

    function register(s) {
        if (s.subject === 'interval') {
            if (s.handler) {
                assertInterval(s.period, s.handler);
            }
        } else if (s.subject === 'shutdown') {
            if (s.handler) {
                assertShutdown(s.handler);
            }
        } else if (s.subject === 'batch') {
            s.subs.forEach(register);
        }
    }
}


function assertInterval(period, handler) {
    if (!intervalTimers[period]) {
        intervalTimers[period] = setInterval(intervalHandler(period), period);
    }

    if (!intervalHandlers[period]) {
        intervalHandlers[period] = [];
    }

    intervalHandlers[period].push(handler);
}


function assertShutdown(handler) {
    shutdownHandlers.push(handler);
}


function intervalHandler(period) {
    return () => {
        if (intervalHandlers[period]) {
            intervalHandlers[period].forEach(command => startRay(command));
        }
    };
}


function startRay(command) {
    return execute({ ...command, rayId: uuid.v4() });
}


function execute(cmd /*: Cmd */) {
    if (!cmd) {
        return;
    }

    const task = cmd.task;

    if (!task) {
        return;
    }

    task._perform(cmd.rayId, payload => {
        propagateUpdate(cmd.rayId, { name: cmd.message, payload });
    });

}


function propagateUpdate(rayId, msg) {
    if (!update) {
        return;
    }

    const updateCase = update[msg.name];

    if (!updateCase) {
        throw new Error('Unknown message ' + msg.name);
    }

    process.nextTick(() => {
        const nextStep = updateCase(msg.payload, model);
        if (nextStep) {
            const [m, cmd] = nextStep;
            dump(m);
            trackUpdate(rayId, msg, m, cmd);
            if (model !== m) {
                model = m;
                if (typeof subscriptions === 'function') {
                    registerSubscriptions(subscriptions(model));
                }
            }
            execute({ ...cmd, rayId });
        } else {
            trackUpdate(rayId, msg, model, noCmd());
        }
    });
}


function dump(m) {
    if (process.env.PERSIST_STORE) {
        fs.writeFileSync(process.env.PERSIST_STORE, JSON.stringify(m, null, '  '));
    }
}
