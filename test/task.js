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
            .step(({ url }) => {
                expect(url).toEqual('http://example.com');
                return { result: 'success', data: { hello: 'world' } };
            })
            .step(({ url }) => {
                expect(url).toEqual('https://github.com');
                return { result: 'success', data: { foo: 'bar' } };
            })
            .step(({ url }) => {
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

});
