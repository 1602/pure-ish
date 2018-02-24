'use strict';

exports.task = task;
exports.sequence = sequence;
exports.succeed = succeed;
exports.fail = fail;


function task(spec, handler) {
    return {
        ...spec,
        object: 'task',
        andThen(fn) {
            return task({
                task: this,
                next: fn,
            }, chain);
        },
        map(fn) {
            return task({
                task: this,
                next: fn,
            }, map);
        },
        attempt(message) {
            return { object: 'command', task: this, message };
        },
        handler,
    };
}


function chain(task, onComplete) {
    const { handler } = task.task;

    handler(task.task, res => {
        if (res.result === 'success') {
            performTask(task.next(res.data), onComplete);
        } else {
            onComplete(res);
        }
    });
}


function map(task, onComplete) {
    const { handler } = task.task;

    handler(task.task, res => {
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


function performTask(task, onComplete) {
    const { handler } = task;
    handler(task, onComplete);
}

