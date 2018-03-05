'use strict';

// @flow

const decoders = module.exports = {
    decodeValue,
    value: <T: any, Spec: null>(): Decoder<T, null> =>
        decoder('value', null, (x: null, v) => succeed(v)),

    string: <T: string, Spec: null>(): Decoder<string, null> =>
        decoder('string', null, decodeString),

    boolean: <T: boolean, Spec: null>(): Decoder<boolean, null> =>
        decoder('boolean', null, decodeBoolean),

    number: <T: number, Spec: null>(): Decoder<number, null> =>
        decoder('number', null, decodeNumber),

    object: <T, Spec: { [string]: any }>(spec: Spec): Decoder<T, Spec> =>
        decoder('object', spec, decodeObject),

    array: <T, Spec: Decoder<T, any>>(spec: Spec): Decoder<Array<T>, any> =>
        decoder('array', spec, decodeArray),

    constant: <T, Spec>(spec: any): Decoder<T, any> =>
        decoder('constant', spec, decodeConstant),

    oneOf: <T, Spec: Array<Decoder<any,any>>>(spec: Spec): Decoder<any, any> =>
        decoder('oneOf', spec, decodeOneOf),

    optional: <T, Spec>(decoder: any): Decoder<T, any> =>
        decoders.oneOf([decoders.constant(), decoder]),

    nullable: <T, Spec>(decoder: any): Decoder<T, any> =>
        decoders.oneOf([decoders.constant(null), decoder]),

    succeed: <T: any, Spec: any>(v: Spec): Decoder<T, any> =>
        decoder('succeed', v, (spec, v) => succeed(spec)),

    fail: <T, Spec: string>(v: Spec): Decoder<T, any> =>
        decoder('fail', v, fail),

    lazy: <A, Spec>(fn: () => Decoder<A, Spec>): Decoder<A, any> =>
        decoder('lazy', fn, decodeLazy),
};


type MappingFunction<A, B> = <A, B>(A) => B


type MapSpec<A, B> = {
    decoder: Decoder<A, any>,
    fn: MappingFunction<A, B>
};


export type Result<T> = Failure | Success<T>;


type Failure = {|
    result: 'failure',
    error: string
|};


type Success<T> = {|
    result: 'success',
    data: T
|};


export type Decoder<T, Spec> = {
    object: 'decoder',
    type: string,
    spec: Spec,
    handler: (Spec, any) => Result<T>,
    andThen: <A: T, B>((A) => Decoder<B, any>) => Decoder<B, any>,
    map: (MappingFunction<T, any>) => Decoder<any, any>,
};


function decodeValue<T, Spec>(decoder: Decoder<T, Spec>, v: any): Result<T> {
    return decoder.handler(decoder.spec, v);
}


function decodeLazy<A, Spec>(fn: () => Decoder<A, Spec>, v: any): Result<A> {
    return decodeValue(fn(), v);
}


function decodeString<T>(x: null, value: any): Result<string> {
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


function decodeNumber<T>(x: any, value: any): Result<number> {
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


function decodeBoolean<T>(x: any, value: any): Result<boolean> {
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


function decodeObject<T>(spec: { [string]: any }, value: any): Result<T> {
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
            .reduce(<T>(accumulator: Result<T>, specKey: string): Result<T> => {
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


function decodeArray<A, Spec>(decoder: Decoder<A, Spec>, value): Result<Array<A>> {
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


function decodeConstant<T>(spec: T, value: any): Result<T> {
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


function succeed<T>(data: T): Result<T> {
    return {
        result: 'success',
        data,
    };
}


function fail(error: string) : Failure {
    return {
        result: 'failure',
        error,
    };
}


function decodeMap<A, B, Spec: MapSpec<A, B>>(spec : Spec, v: any): Result<B> {
    const res = decodeValue(spec.decoder, v);

    if (res.result === 'failure') {
        return res;
    }

    return succeed(spec.fn(res.data));
}


function decodeAndThen<T>({ decoder, next }, v): Result<T> {
    const res = decodeValue(decoder, v);
    if (res.result === 'failure') {
        return res;
    }

    return decodeValue(next(res.data), v);
}


function decoder<T, Spec>(type: string, spec: Spec, handler: (Spec, any) => Result<T>): Decoder<T, Spec> {
    return Object.create({
        map<A, B>(fn: MappingFunction<A, B>) {
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

