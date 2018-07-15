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
let model = undefined;
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
    subscriptions = definitions.subscriptions;

    function startApp(state, action) {
        if (typeof state === 'undefined') {
            const initialCheckpoint = definitions.init(data);
            state = initialCheckpoint[0];
            action = initialCheckpoint[1];
        }

        step(uuid.v4(), { object: 'message', name: '$init', payload: state }, [state, action]);
    }

    if (debug) {
        debug.start({
            onStart: startApp,
            // resumeCallback(state, rayId, message, payload);
            onResume: (state, rayId, name, payload) => {
                model = state;
                propagateUpdate(rayId, { name, payload });
                registerSubscriptions(subscriptions(model));
            }
        });
    } else {
        startApp();
    }

    return {
        finish() {
            stopApplication();
            stopTimers();
            stopDebugger();
        }
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
            intervalHandlers[period].forEach(msg => {
                if (debug && debug.isPaused()) {
                    return;
                }
                propagateUpdate(uuid.v4(), { name: msg, payload: { result: 'success', data: Date.now() } })
            });
        }
    };
}


function startRay(command) {
    if (debug && debug.isPaused()) {
        return;
    }

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

    if (typeof update === 'function') {
        next(msg, update);
        return;
    }

    const updateCase = update[msg.name];
    const caseType = typeof updateCase;

    if (typeof updateCase === 'function') {
        next(msg.payload, updateCase);
        return;
    }

    if (typeof updateCase === 'object') {

        if (Array.isArray(updateCase)) {
            handleCheckpoint(updateCase[0], updateCase[1]);
        } else {
            handleCheckpoint(updateCase.success, updateCase.failure);
        }

        return;
    }

    console.error('Checkpoint "%s" is not registered', msg.name);
    handleNextStep();

    function handleCheckpoint(success, failure) {
        if (msg.payload.result === 'success') {
            if (typeof success === 'function') {
                return next(msg.payload.data, success);
            }

            console.error('Success case is not registered for checkpoint "%s", leaving unhandled', msg.name);

            return handleNextStep();
        }

        if (msg.payload.result === 'failure') {
            if (typeof failure === 'function') {
                return next(msg.payload.error, failure);
            }

            console.error('Failure case is not registered for checkpoint "%s", leaving unhandled', msg.name);

            return handleNextStep();
        }
    }

    function next(arg, handler) {
        process.nextTick(() => handleNextStep(handler(arg, model)));
    }


    function handleNextStep(nextStep) {
        step(rayId, msg, nextStep || [model, noCmd()]);
    }
}

function step(rayId, msg, [state, action]) {
    const command = { ...action, rayId };
    trackUpdate(rayId, msg, state, command);
    if (model !== state) {
        model = state;
        if (typeof subscriptions === 'function') {
            registerSubscriptions(subscriptions(model));
        }
    }
    // in step-by-step mode command executed after receiving a signal from a master process (debugger)
    execute(command);
}

