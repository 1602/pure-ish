'use strict';

const expect = require('expect');
const { objectContaining } = expect;
const jest = require('jest-mock');
const { decodeValue, value, string, number, boolean, array, object, constant, oneOf, optional, nullable, lazy, fail, succeed } = require('../decoder.js');

describe('Decoder', () => {

    describe('value', () => {

        it('always decodes successfully', () =>
            expect(decodeValue(value(), 'hello')).toEqual({
                result: 'success',
                data: 'hello',
            }));

    });

    describe('string', () => {

        it('decodes successfully', () =>
            expect(decodeValue(string(), 'hello')).toEqual({
                result: 'success',
                data: 'hello',
            }));

        it('decodes with error', () =>
            expect(decodeValue(string(), 1602)).toEqual({
                result: 'failure',
                error: 'Expected string but received number 1602',
            }));

        it('expects non-null value', () =>
            expect(decodeValue(string(), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected string but received null',
                }));

        it('expect non-undefined value', () =>
            expect(decodeValue(string(), undefined))
                .toEqual({
                    result: 'failure',
                    error: 'Expected string but received undefined',
                }));

    });

    describe('number', () => {

        it('decodes successfully', () =>
            expect(decodeValue(number(), 1602)).toEqual({
                result: 'success',
                data: 1602,
            }));

        it('decodes with error', () =>
            expect(decodeValue(number(), '1602')).toEqual({
                result: 'failure',
                error: 'Expected number but received string 1602',
            }));

        it('expects non-null value', () =>
            expect(decodeValue(number(), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected number but received null',
                }));

        it('expect non-undefined value', () =>
            expect(decodeValue(number(), undefined))
                .toEqual({
                    result: 'failure',
                    error: 'Expected number but received undefined',
                }));

    });

    describe('boolean', () => {

        it('decodes successfully', () =>
            expect(decodeValue(boolean(), true)).toEqual({
                result: 'success',
                data: true,
            }));

        it('decodes with error', () =>
            expect(decodeValue(boolean(), '1602')).toEqual({
                result: 'failure',
                error: 'Expected boolean but received string 1602',
            }));

        it('expects non-null value', () =>
            expect(decodeValue(boolean(), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected boolean but received null',
                }));

        it('expect non-undefined value', () =>
            expect(decodeValue(boolean(), undefined))
                .toEqual({
                    result: 'failure',
                    error: 'Expected boolean but received undefined',
                }));

    });

    describe('object', () => {
        it('decodes successfully', () =>
            expect(decodeValue(object({ foo: string() }), { foo: 'bar' }))
                .toEqual({
                    result: 'success',
                    data: { foo: 'bar' },
                }));

        it('drops extra props', () =>
            expect(decodeValue(object({ foo: string() }), { foo: 'bar', hey: 'jude' }))
                .toEqual({
                    result: 'success',
                    data: { foo: 'bar' },
                }));

        it('expects object', () =>
            expect(decodeValue(object({}), 'hello'))
                .toEqual({
                    result: 'failure',
                    error: 'Expected object but received string hello',
                }));

        it('expects non-null value', () =>
            expect(decodeValue(object({}), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected object but received null',
                }));

        it('expect non-undefined value', () =>
            expect(decodeValue(object({}), undefined))
                .toEqual({
                    result: 'failure',
                    error: 'Expected object but received undefined',
                }));

        it('fails when property decoding fails', () =>
            expect(decodeValue(object({ foo: string(), bar: value() }), { foo: 1, bar: 2 }))
                .toEqual({
                    result: 'failure',
                    error: 'foo: Expected string but received number 1',
                }));
    });

    describe('array', () => {

        it('decodes successfully', () =>
            expect(decodeValue(array(string()), ['hello']))
                .toEqual({
                    result: 'success',
                    data: ['hello'],
                }));

        it('expects non-null value', () =>
            expect(decodeValue(array(value()), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected array but received null',
                }));

        it('expects array', () =>
            expect(decodeValue(array(value()), 'not array'))
                .toEqual({
                    result: 'failure',
                    error: 'Expected array but received string',
                }));

        it('expect non-undefined value', () =>
            expect(decodeValue(array(value()), undefined))
                .toEqual({
                    result: 'failure',
                    error: 'Expected array but received undefined',
                }));

        it('decodes empty array successfully', () =>
            expect(decodeValue(array(string()), []))
                .toEqual({
                    result: 'success',
                    data: [],
                }));

        it('finds incorrect item', () =>
            expect(decodeValue(array(string()), ['hello', 1, '2']))
                .toEqual({
                    result: 'failure',
                    error: 'Array item 1: Expected string but received number 1',
                }));

    });


    describe('constant', () => {

        it('decodes successfully', () =>
            expect(decodeValue(constant('exactly this'), 'exactly this')).toEqual({
                result: 'success',
                data: 'exactly this',
            }));

        it('requires type matching', () =>
            expect(decodeValue(constant('1602'), 1602)).toEqual({
                result: 'failure',
                error: 'Expected string 1602 but received number 1602',
            }));

        it('expects non-null value', () =>
            expect(decodeValue(constant('1602'), null))
                .toEqual({
                    result: 'failure',
                    error: 'Expected string 1602 but received null',
                }));

        it('expect undefined value', () =>
            expect(decodeValue(constant(), undefined))
                .toEqual({
                    result: 'success',
                }));

    });

    describe('oneOf', () => {

        it('decodes successfully', () =>
            expect(decodeValue(oneOf([constant('exactly this'), constant(null)]), null)).toEqual({
                result: 'success',
                data: null,
            }));

        it('fails when all decoders fail', () =>
            expect(decodeValue(oneOf([string(), number()]), null)).toEqual({
                result: 'failure',
                error: 'All decoders failed:\n - Expected string but received null\n - Expected number but received null',
            }));

    });

    describe('optional', () => {

        it('decodes successfully', () =>
            expect(decodeValue(object({ hello: optional(string()) }), {})).toEqual({
                result: 'success',
                data: {},
            }));
    });

    describe('nullable', () => {

        it('decodes successfully', () =>
            expect(decodeValue(object({ hello: nullable(string()) }), { hello: null })).toEqual({
                result: 'success',
                data: { hello: null },
            }));
    });

    describe('lazy', () => {

        it('facilitates recursive decoders', () => {
            const comment = object({
                text: string(),
                discussion: array(lazy(() => comment)),
            });

            expect(decodeValue(comment, { text: 'hello', discussion: [{ text: 'hi', discussion: [] }] }))
                .toEqual(objectContaining({ result: 'success' }));
        });
    });

    describe('decoder.map', () => {

        it('transforms decoded value', () =>
            expect(decodeValue(string().map(s => s.toUpperCase()), 'nasa'))
                .toEqual({ result: 'success', data: 'NASA' }));

        it('chains only in case of success', () => {
            const spy = jest.fn(x => x.toUppercase());
            expect(decodeValue(number().map(spy), 'h')).toEqual(objectContaining({ result: 'failure' }));
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('decoder.andThen', () => {

        it('chains decoders', () => {
            const versionedDecoder = object({ version: number() })
                .andThen(({version}) => object({ id: version === 1 ? string() : number () }));

            expect(decodeValue(versionedDecoder, { version: 1, id: 'uuid' }))
                .toEqual({ result: 'success', data: { id: 'uuid' } });

            expect(decodeValue(versionedDecoder, { version: 2, id: 1 }))
                .toEqual({ result: 'success', data: { id: 1 } });

            expect(decodeValue(versionedDecoder, { version: 2, id: 'uuid' }))
                .toEqual({ result: 'failure', error: 'id: Expected number but received string uuid' });

            expect(decodeValue(versionedDecoder, { version: 1, id: 1 }))
                .toEqual({ result: 'failure', error: 'id: Expected string but received number 1' });
        });

        it('chains only in case of success', () => {
            const spy = jest.fn(succeed);
            expect(decodeValue(number().andThen(spy), 'h')).toEqual(objectContaining({ result: 'failure' }));
            expect(spy).not.toHaveBeenCalled();
        });

    });

    describe('fail', () => {

        it('allows to alter error message', () => {
            const optionalString = oneOf([constant(), string(), succeed(-1)]).andThen(s => s === -1 ? fail('Not string or undefined') : succeed(s));
            expect(decodeValue(optionalString, 1)).toEqual({ result: 'failure', error: 'Not string or undefined' });
        });
    });

});
