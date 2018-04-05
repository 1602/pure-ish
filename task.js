'use strict';

exports.task = task;
exports.sequence = sequence;
exports.succeed = succeed;
exports.fail = fail;
exports.promisify = promisify;

const { debug } = require('./index.js');

function task(spec, handler) {
    let resolvedResult = null;
    let rejectedResult = null;

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
        mapError(fn) {
            this.continuation.push({ operation: 'mapError', fn });
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

            // and this hack :(
            if (rejectedResult) {
                throw rejectedResult;
            }
            // TODO: revisit mocking api (handle error and final result of chain)

            const result = mock(this.spec);
            if (result.result === 'success') {
                let { data } = result;
                while (true) {
                    const c = tryContinuation.call(this, data);
                    if (c.continue) {
                        data = c.data;
                    } else {
                        break;
                    }
                }
                return;
            }

            if (result.result === 'failure') {
                const errorMapping = this.continuation.filter(c => c.operation === 'mapError').map(c => c.fn);
                rejectedResult = errorMapping.reduce((accumulator, errorMapperFn) => errorMapperFn(accumulator), result.error);
            }

            return this;

            function tryContinuation(data) {
                if (this.continuation.length) {
                    const next = this.continuation.shift();
                    if (next.operation === 'chain') {
                        const nextTask = next.fn(data);
                        if (nextTask && nextTask.spec && nextTask.spec.task === 'succeed') {
                            return { continue: true, data: nextTask.spec.data };
                        }
                        if (nextTask && nextTask.spec && nextTask.spec.task === 'fail') {
                            rejectedResult = nextTask.spec.error;
                            return { continue: false };
                        }
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

            async function runTask() {
                const time = Date.now();

                if (debug && debug.isStepByStep()) {
                    await debug.confirmationSignal(spec);
                }

                handler(spec, data => {

                    if (debug) {
                        debug.send({
                            event: 'task',
                            rayId,
                            spec,
                            result: { result: 'success', data },
                            duration: Date.now() - time
                        });
                    }

                    while (true) {
                        if (continuation.length === 0) {
                            succeed(data);
                            break;
                        }

                        const next = continuation.shift();
                        if (next.operation === 'chain') {
                            let nextTask;
                            try {
                                nextTask = next.fn(data);
                            } catch (error) {
                                const { message, code, stack, details } = error;
                                return fail({ message, code, stack, details });
                            }
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
                                const { message, code, stack, details } = error;
                                return fail({ message, code, stack, details });
                            }
                        } else if (next.operation !== 'mapError') {
                            throw new Error('Unknown operation');
                        }
                    }
                }, error => fail(error));


                function succeed(data) {
                    onComplete({ result: 'success', data });
                }

                function fail(error) {
                    if (debug) {
                        debug.send({
                            event: 'task',
                            rayId,
                            spec,
                            result: { result: 'failure', error },
                            duration: Date.now() - time
                        });
                    }

                    const errorMapping = continuation.filter(c => c.operation === 'mapError').map(c => c.fn);

                    onComplete({
                        result: 'failure',
                        error: errorMapping.reduce((accumulator, errorMapperFn) => errorMapperFn(accumulator), error)
                    });
                }
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
    return task(
        { task: 'succeed', data },
        ({ data }, resolve) => resolve(data)
    );
}

function fail(error) {
    return task(
        { task: 'fail', error },
        ({ error }, resolve, reject) => reject(error)
    );
}

function promisify(fn) {
    return function(spec, resolve, reject) {
        Promise
            .resolve()
            .then(() => fn(spec))
            .then(resolve)
            .catch(reject);
    };
}
