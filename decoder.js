'use strict';

// 

const decoders = module.exports = {
    decodeValue,
    value:() =>
        decoder('value', null, (x, v) => succeed(v)),

    string:() =>
        decoder('string', null, decodeString),

    boolean:() =>
        decoder('boolean', null, decodeBoolean),

    number:() =>
        decoder('number', null, decodeNumber),

    object:(spec) =>
        decoder('object', spec, decodeObject),

    array:(spec) =>
        decoder('array', spec, decodeArray),

    constant:(spec) =>
        decoder('constant', spec, decodeConstant),

    oneOf:(spec) =>
        decoder('oneOf', spec, decodeOneOf),

    optional:(decoder) =>
        decoders.oneOf([decoders.constant(), decoder]),

    nullable:(decoder) =>
        decoders.oneOf([decoders.constant(null), decoder]),

    succeed:(v) =>
        decoder('succeed', v, (spec, v) => succeed(spec)),

    fail:(v) =>
        decoder('fail', v, fail),

    lazy:(fn) =>
        decoder('lazy', fn, decodeLazy),
};


;

;


function decodeValue(decoder, v) {
    return decoder.handler(decoder.spec, v);
}


function decodeLazy(fn, v) {
    return decodeValue(fn(), v);
}


function decodeString(x, value) {
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

function decodeNumber(x, value) {
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

function decodeBoolean(x, value) {
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
        const props = Object
            .keys(spec)
            .reduce((accumulator, specKey) => {
                if (accumulator.result === 'failure') {
                    return accumulator;
                }

                const propertyDecoder = spec[specKey];
                const decodingPropertyResult = decodeValue(propertyDecoder, value[specKey]);
                if (decodingPropertyResult.result === 'success') {
                    return succeed(
                         Object.defineProperty(
                            accumulator.data,
                            specKey,
                            { value: { value: decodingPropertyResult.data, enumerable: true }, enumerable: true }
                        )
                    );
                }

                decodingPropertyResult.error = specKey + ': ' + decodingPropertyResult.error;

                return decodingPropertyResult;
            }, succeed(Object.create(null)));

        if (props.result === 'failure') {
            return fail(props.error);
        }

        return succeed(Object.create(null, props.data));
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
        return fail(`Expected ${ expectedType } ${ String(spec) } but received null`);
    }

    if (actualType === 'undefined' && expectedType === 'undefined') {
        return succeed(value);
    }

    if (actualType === expectedType && spec === value) {
        return succeed(value);
    }

    return fail(`Expected ${ expectedType } ${ String(spec) } but received ${ actualType } ${ value }`);
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
        data,
    };
}


function fail(error) {
    return {
        result: 'failure',
        error,
    };
}




function decodeMap({ decoder, fn }, v) {
    const res = decodeValue(decoder, v);

    if (res.result === 'failure') {
        return res;
    }

    return succeed(fn(res.data));
}


function decodeAndThen({ decoder, next }, v) {
    const res = decodeValue(decoder, v);
    if (res.result === 'failure') {
        return res;
    }

    return decodeValue(next(res.data), v);
}


function decoder(type, spec, handler) {
    return Object.create({
        map(fn) {
            return decoder('map', { decoder: this, fn }, decodeMap);
        },
        andThen(next) {
            return decoder('andThen', { decoder: this, next }, decodeAndThen);
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
        handler: {
            value: handler,
        }
    });
}
