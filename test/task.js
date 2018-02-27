'use strict';

const jest = require('jest-mock');
const expect = require('expect');
const { task } = require('../task');

describe('Task', () => {

    it('should allow chaining', () => {
        const httpRequest = jest.fn();
        const initialRequest = fetch('http://example.com');
        const continuation1 = jest.fn((res) => {
            expect(res).toEqual({ hello: 'world' });
            return fetch('https://github.com');
        });
        const continuation2 = jest.fn((res) => {
            expect(res).toEqual({ foo: 'bar' });
            return fetch('https://gitlab.com');
        });

        const chain = initialRequest
            .andThen(continuation1)
            .andThen(continuation2);

        chain
            .stepOverTask(({ url }) => {
                expect(url).toEqual('http://example.com');
                return { result: 'success', data: { hello: 'world' } };
            })
            .stepOverTask(({ url }) => {
                expect(url).toEqual('https://github.com');
                return { result: 'success', data: { foo: 'bar' } };
            })
            .stepOverTask(({ url }) => {
                expect(url).toEqual('https://gitlab.com');
                return { result: 'success', data: { bar: 'baz' } };
            });

        expect(httpRequest).not.toHaveBeenCalled();
        expect(continuation1).toHaveBeenCalled();
        expect(continuation2).toHaveBeenCalled();


        function fetch(url) {
            return task({ url }, httpRequest);
        }
    });


    it('should allow mapping a value produced by a task', () => {
        const mapping = jest.fn(a => a + 1);
        const expectation = jest.fn(res => expect(res).toEqual(8));

        const chain = task({}, () => {})
            .map(mapping)
            .map(mapping);

        chain
            .stepOverTask(() => ({ result: 'success', data: 6 }))
            .stepOverTask(expectation);

        expect(mapping).toHaveBeenCalledTimes(2);
        expect(expectation).toHaveBeenCalled();
    });

});
