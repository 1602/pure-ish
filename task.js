'use strict';

exports.task = task;
exports.sequence = sequence;
exports.succeed = succeed;
exports.fail = fail;

const { debug } = require('./index.js');

function task(spec, handler) {
    let resolvedResult = null;

    return Object.create({
        object: 'task',
        andThen(fn) {
            this.continuation.push({ operation: 'chain', fn });
            return this;
        },
        map(fn) {
            this.continuation.push({ operation: 'map', fn });
            return this;
        },
        attempt(message) {
            return { object: 'command', task: this, message };
        },
        stepOverTask(mock) {
            // I don't quite like this hack
            if (resolvedResult) {
                return mock(resolvedResult);
            }

            const result = mock(this.spec);
            if (result.result === 'success') {
                let { data } = result;
                while(true) {
                    const c = tryContinuation.call(this, data);
                    if (c.continue) {
                        data = c.data;
                    } else {
                        break;
                    }
                }
            }

            return this;

            function tryContinuation(data) {
                if (this.continuation.length) {
                    const next = this.continuation.shift();
                    if (next.operation === 'chain') {
                        const nextTask = next.fn(data);
                        this.spec = nextTask.spec;
                        this.handler = nextTask.handler;
                        if (nextTask.continuation.length > 0) {
                            this.continuation = nextTask.continuation.concat(this.continuation);
                        }
                        return { continue: false };
                    } else if (next.operation === 'map') {
                        const mappedResult = next.fn(data);
                        return { continue: true, data: mappedResult };
                    }
                } else {
                    resolvedResult = data;
                    return { continue: false };
                }
            }
        },
        _perform(rayId, onComplete) {
            const task = this;
            let { handler, spec } = task;
            let continuation = task.continuation.slice();

            runTask();

            function runTask() {
                const time = Date.now();
                handler(spec, result => {
                    if (debug) {
                        debug.send({ event: 'task', rayId, spec, result, duration: Date.now() - time });
                    }

                    if (result.result === 'success') {
                        let { data } = result;
                        while (true) {
                            if (continuation.length === 0) {
                                onComplete({ result: 'success', data });
                                break;
                            }

                            const next = continuation.shift();
                            if (next.operation === 'chain') {
                                const nextTask = next.fn(data);
                                spec = nextTask.spec;
                                handler = nextTask.handler;
                                if (nextTask.continuation.length > 0) {
                                    continuation = nextTask.continuation.concat(continuation);
                                }
                                runTask();
                                break;
                            } else if (next.operation === 'map') {
                                try {
                                    data = next.fn(data);
                                } catch (error) {
                                    return onComplete({ result: 'failure', error });
                                }
                            } else {
                                throw new Error('Unknown operation');
                            }
                        }
                    } else {
                        onComplete(result);
                    }
                });
            }
        },
    }, {
        continuation: { value: [], enumerable: false, writable: true },
        spec: { value: spec, enumerable: true, writable: true },
        handler: { value: handler, enumerable: false, writable: true },
    });
}



function sequence(tasks) {
    if (tasks.length === 0) {
        return succeed([]);
    }

    return iterate(tasks, []);

    function iterate(tasks, accumulator) {
        if (tasks.length === 0) {
            return succeed(accumulator);
        }

        const [head, ...tail] = tasks;
        return head.andThen(result => {
            accumulator.push(result);
            return iterate(tail, accumulator);
        });
    }
}


function succeed(data) {
    return task({ task: 'succeed', data }, ({ data }, onComplete) => onComplete({ result: 'success', data }));
}


function fail(error) {
    return task({ task: 'fail', error }, ({ error }, onComplete) => onComplete({ result: 'failure', error }));
}

