'use strict';

const decoders = module.exports = {
    decodeValue,
    value: () => decoder('value', null),
    string: () => decoder('string', null),
    boolean: () => decoder('boolean', null),
    number: () => decoder('number', null),
    object: spec => decoder('object', spec),
    array: spec => decoder('array', spec),
    constant: spec => decoder('constant', spec),
    oneOf: spec => decoder('oneOf', spec),
    optional: decoder => decoders.oneOf([decoders.constant(), decoder]),
    nullable: decoder => decoders.oneOf([decoders.constant(null), decoder]),
    succeed: v => decoder('succeed', v),
    fail: v => decoder('fail', v),
    lazy: fn => decoder('lazy', fn),
};

function decodeValue(decoder, v) {
    if (decoder.type === 'value') {
        return succeed(v);
    }

    if (decoder.type === 'string') {
        return decodeString(v);
    }

    if (decoder.type === 'number') {
        return decodeNumber(v);
    }

    if (decoder.type === 'boolean') {
        return decodeBoolean(v);
    }

    if (decoder.type === 'object') {
        return decodeObject(decoder.spec, v);
    }

    if (decoder.type === 'array') {
        return decodeArray(decoder.spec, v);
    }

    if (decoder.type === 'constant') {
        return decodeConstant(decoder.spec, v);
    }

    if (decoder.type === 'oneOf') {
        return decodeOneOf(decoder.spec, v);
    }

    if (decoder.type === 'succeed') {
        return succeed(decoder.spec);
    }

    if (decoder.type === 'fail') {
        return fail(decoder.spec);
    }

    if (decoder.type === 'lazy') {
        return decodeValue(decoder.spec(), v);
    }

    if (decoder.type === 'map') {
        return decodeMap(decoder.spec, v);
    }

    if (decoder.type === 'andThen') {
        return decodeAndThen(decoder.spec, v);
    }

    return fail('Unknown decoder type: ' + decoder.type);
}

function decodeString(value) {
    if (value === null) {
        return fail('Expected string but received null');
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return fail('Expected string but received undefined');
    }

    if (actualType === 'string') {
        return succeed(value);
    }

    return fail(`Expected string but received ${ actualType } ${ value }`);
}

function decodeNumber(value) {
    if (value === null) {
        return fail('Expected number but received null');
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return fail('Expected number but received undefined');
    }

    if (actualType === 'number') {
        return succeed(value);
    }

    return fail(`Expected number but received ${ actualType } ${ value }`);
}

function decodeBoolean(value) {
    if (value === null) {
        return fail('Expected boolean but received null');
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return fail('Expected boolean but received undefined');
    }

    if (actualType === 'boolean') {
        return succeed(value);
    }

    return fail(`Expected boolean but received ${ actualType } ${ value }`);
}

function decodeObject(spec, value) {
    if (value === null) {
        return fail('Expected object but received null');
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return fail('Expected object but received undefined');
    }

    if (actualType === 'object') {
        return Object
            .keys(spec)
            .reduce((accumulator, specKey) => {
                if (accumulator.result === 'failure') {
                    return accumulator;
                }

                const propertyDecoder = spec[specKey];
                const decodingPropertyResult = decodeValue(propertyDecoder, value[specKey]);
                if (decodingPropertyResult.result === 'success') {
                    accumulator.data[specKey] = decodingPropertyResult.data;
                    return accumulator;
                }

                decodingPropertyResult.error = specKey + ': ' + decodingPropertyResult.error;

                return decodingPropertyResult;
            }, succeed({}));
    }

    return fail(`Expected object but received ${ actualType } ${ value }`);
}

function decodeArray(decoder, value) {
    if (value === null) {
        return fail('Expected array but received null');
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return fail('Expected array but received undefined');
    }

    if (actualType !== 'object' || !Array.isArray(value)) {
        return fail(`Expected array but received ${ actualType }`);
    }

    return value.reduce((accumulator, value, index) => {
        if (accumulator.result === 'failure') {
            return accumulator;
        }

        const itemDecodingResult = decodeValue(decoder, value);
        if (itemDecodingResult.result === 'success') {
            accumulator.data.push(itemDecodingResult.data);
            return accumulator;
        }

        itemDecodingResult.error = `Array item ${ index }: ${ itemDecodingResult.error }`;
        return itemDecodingResult;
    }, succeed([]));
}

function decodeConstant(spec, value) {
    const actualType = typeof value;
    const expectedType = typeof spec;

    if (value === null && spec !== null) {
        return fail(`Expected ${ expectedType } ${ spec } but received null`);
    }

    if (actualType === 'undefined' && expectedType === 'undefined') {
        return succeed(value);
    }

    if (actualType === expectedType && spec === value) {
        return succeed(value);
    }

    return fail(`Expected ${ expectedType } ${ spec } but received ${ actualType } ${ value }`);
}


function decodeOneOf(spec, value) {
    return spec.reduce((accumulator, decoder) => {
        if (accumulator.result === 'success') {
            return accumulator;
        };

        const decodingResult = decodeValue(decoder, value);
        if (decodingResult.result === 'failure') {
            accumulator.error += '\n - ' + decodingResult.error;
            return accumulator;
        }

        return decodingResult;
    }, fail('All decoders failed:'));
}


function succeed(data) {
    return {
        result: 'success',
        data
    };
}


function fail(error) {
    return {
        result: 'failure',
        error
    };
}


function decodeMap({ decoder, fn }, v) {
    const res = decodeValue(decoder, v);
    if (res.result === 'success') {
        res.data = fn(res.data);
    }
    return res;
}

function decodeAndThen({ decoder, next }, v) {
    const res = decodeValue(decoder, v);
    if (res.result === 'success') {
        return decodeValue(next(res.data), v);
    }
    return res;
}


function decoder(type, spec) {
    return Object.create({
        map(fn) {
            return decoder('map', { decoder: this, fn });
        },
        andThen(next) {
            return decoder('andThen', { decoder: this, next });
        },
    }, {
        object: {
            value: 'decoder',
            writable: false,
            enumerable: false,
        },
        type: {
            value: type,
            writable: false,
            enumerable: true,
        },
        spec: {
            value: spec,
            writable: false,
            enumerable: true,
        },
    });
}
