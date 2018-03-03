'use strict';

module.exports = {
    decodeValue,
    value,
    string,
    number,
    boolean,
    object,
    array,
    constant,
    oneOf,
    optional,
    nullable,
};

function decodeValue(decoder, v) {
    if (decoder.type === 'value') {
        return {
            result: 'success',
            data: v,
        };
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
}

function decodeString(value) {
    if (value === null) {
        return {
            result: 'failure',
            error: `Expected string but received null`,
        };
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return {
            result: 'failure',
            error: `Expected string but received undefined`,
        };
    }

    if (actualType === 'string') {
        return {
            result: 'success',
            data: value,
        };
    }

    return {
        result: 'failure',
        error: `Expected string but received ${ actualType } ${ value }`,
    };
}

function decodeNumber(value) {
    if (value === null) {
        return {
            result: 'failure',
            error: `Expected number but received null`,
        };
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return {
            result: 'failure',
            error: `Expected number but received undefined`,
        };
    }

    if (actualType === 'number') {
        return {
            result: 'success',
            data: value,
        };
    }

    return {
        result: 'failure',
        error: `Expected number but received ${ actualType } ${ value }`,
    };
}

function decodeBoolean(value) {
    if (value === null) {
        return {
            result: 'failure',
            error: `Expected boolean but received null`,
        };
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return {
            result: 'failure',
            error: `Expected boolean but received undefined`,
        };
    }

    if (actualType === 'boolean') {
        return {
            result: 'success',
            data: value,
        };
    }

    return {
        result: 'failure',
        error: `Expected boolean but received ${ actualType } ${ value }`,
    };
}

function decodeObject(spec, value) {
    if (value === null) {
        return {
            result: 'failure',
            error: `Expected object but received null`,
        };
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return {
            result: 'failure',
            error: `Expected object but received undefined`,
        };
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
            }, { result: 'success', data: {} });
    }

    return {
        result: 'failure',
        error: `Expected object but received ${ actualType } ${ value }`,
    };
}

function decodeArray(decoder, value) {
    if (value === null) {
        return {
            result: 'failure',
            error: `Expected array but received null`,
        };
    }

    const actualType = typeof value;

    if (actualType === 'undefined') {
        return {
            result: 'failure',
            error: `Expected array but received undefined`,
        };
    }

    if (actualType !== 'object' || !Array.isArray(value)) {
        return {
            result: 'failure',
            error: `Expected array but received ${ actualType }`,
        };
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
    }, { result: 'success', data: [] });
}

function decodeConstant(spec, value) {
    const actualType = typeof value;
    const expectedType = typeof spec;

    if (value === null && spec !== null) {
        return {
            result: 'failure',
            error: `Expected ${ expectedType } ${ spec } but received null`,
        };
    }

    if (actualType === 'undefined' && expectedType === 'undefined') {
        return {
            result: 'success',
            data: value,
        };
    }

    if (actualType === expectedType && spec === value) {
        return {
            result: 'success',
            data: value,
        };
    }

    return {
        result: 'failure',
        error: `Expected ${ expectedType } ${ spec } but received ${ actualType } ${ value }`,
    };
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
    }, { result: 'failure', error: 'All decoders failed:' });
}

function value() {
    return {
        object: 'decoder',
        type: 'value',
    };
}

function string() {
    return {
        object: 'decoder',
        type: 'string',
    };
}

function boolean() {
    return {
        object: 'decoder',
        type: 'boolean',
    };
}

function number() {
    return {
        object: 'decoder',
        type: 'number',
    };
}

function object(spec) {
    return {
        object: 'decoder',
        type: 'object',
        spec,
    };
}

function array(spec) {
    return {
        object: 'decoder',
        type: 'array',
        spec,
    };
}

function constant(spec) {
    return {
        object: 'decoder',
        type: 'constant',
        spec,
    };
}

function oneOf(spec) {
    return {
        object: 'decoder',
        type: 'oneOf',
        spec,
    };
}

function optional(decoder) {
    return oneOf([constant(), decoder]);
}

function nullable(decoder) {
    return oneOf([constant(null), decoder]);
}

