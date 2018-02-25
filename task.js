'use strict';

exports.task = task;
exports.sequence = sequence;
exports.succeed = succeed;
exports.fail = fail;


function task(spec, handler) {
    return Object.create({
        object: 'task',
        andThen(fn) {
            this.continuation.push({ operation: 'chain', fn });
            return this;
            /*
            return task({
                task: this,
                next: fn,
            }, chain);
            */
        },
        map(fn) {
            this.continuation.push({ operation: 'map', fn });
            return this;
            /*
            return task({
                task: this,
                next: fn,
            }, map);
            */
        },
        attempt(message) {
            return { object: 'command', task: this, message };
        },
        step(mock) {
            const result = mock(this.spec);
            if (result.result === 'success') {
                if (this.continuation.length) {
                    const next = this.continuation.shift();
                    if (next.operation === 'chain') {
                        const nextTask = next.fn(result.data);
                        this.spec = nextTask.spec;
                        this.handler = nextTask.handler;
                        this.continuation = nextTask.continuation.concat(this.continuation);
                    } else if (next.operation === 'map') {
                        // implement map
                    }
                }
            }
            return this;
        },
        _perform(onComplete) {
            const { handler, spec } = this;

            handler(spec, onComplete);
        },
    }, {
        continuation: { value: [], enumerable: false, writable: true },
        spec: { value: spec, enumerable: true, writable: true },
        handler: { value: handler, enumerable: false, writable: true },
    });
}


function chain(spec, onComplete) {
    spec.task._perform(res => {
        if (res.result === 'success') {
            spec.next(res.data)._perform(onComplete);
        } else {
            onComplete(res);
        }
    });
}


function map(task, onComplete) {
    const { handler } = task.task;

    handler(task.task.spec, res => {
        if (res.result === 'success') {
            res.data = task.next(res.data);
        }
        onComplete(res);
    });
}


function sequence(tasks) {
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
    return task(null, (x, onComplete) => onComplete({ result: 'success', data }));
}


function fail(error) {
    return task(null, (x, onComplete) => onComplete({ result: 'failure', error }));
}

