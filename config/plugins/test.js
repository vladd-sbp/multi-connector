'use strict';
/**
 * Test plugin.
 */

/**
 * Generates random value.
 *
 * @param {Number} min
 * @param {Number} max
 * @param {Number} decimalPlaces
 * @return {Number}
 */
const genRand = function (min, max, decimalPlaces) {
    const rand = Math.random() * (max - min) + min;
    const power = Math.pow(10, decimalPlaces);
    return Math.floor(rand * power) / power;
};

/**
 * Generates test data by id and time range.
 *
 * @param {String} id
 * @param {String} key
 * @param {String} type
 * @param {Number} value
 * @param {Number} min
 * @param {Number} max
 * @param {Number} decimals
 * @param {Array} range
 * @param {Number} interval
 * @return {Array}
 */
const generateData = function (id, key = 'value', type = 'temp', value = null,
    min, max, decimals, range, interval = 600000) {
    if (min === undefined && max === undefined) {
        switch (type) {
            case 'humidity':
                ({min, max, decimals} = {min: 30, max: 50, decimals: 2});
                break;
            case 'co2':
                ({min, max, decimals} = {min: 450, max: 800, decimals: 0});
                break;
            case 'noise':
                ({min, max, decimals} = {min: 36, max: 41, decimals: 0});
                break;
            case 'rating':
                ({min, max, decimals} = {min: 1, max: 5, decimals: 0});
                break;
            case 'motion':
                ({min, max, decimals} = {min: 1, max: 10, decimals: 0});
                break;
            case 'reserved':
                ({min, max, decimals} = {min: 0, max: 1, decimals: 0});
                break;
            default:
                // temp
                ({min, max, decimals} = {min: 19, max: 26, decimals: 2});
        }
    }
    const entry = {
        type,
        [key]: value || genRand(min, max, decimals),
        name: 'Sensor ' + id,
        id,
    };
    if (range) {
        const data = [];
        let length = 1;
        if (range[0].toString() !== 'Invalid Date'
            && range[1].toString() !== 'Invalid Date') {
            length = Math.max(Math.floor((range[1].getTime() - range[0].getTime()) / interval), 1);
        } else {
            range[0] = new Date.now();
        }
        for (let i = 0; i < length; i++) {
            data[i] = {
                type,
                timestamp: range[0].getTime() + i * interval,
                [key]: value || genRand(min, max, decimals),
                name: 'Sensor ' + id,
                id,
            };
        }
        return data;
    } else {
        return [entry];
    }
};

/**
 * Generates test data by given attributes.
 *
 * @param {Object} config
 * @param {Object/String} res
 * @return {Object}
 */
const response = async (config, res) => {
    const response = [];

    /** Data fetching. */
    try {
        let range;
        if (config.mode === 'history' || config.mode === 'prediction') {
            range = [config.parameters.start, config.parameters.end];
        }

        const inputTypes = (config.parameters.options || {}).types || [];
        const types = inputTypes.length > 0 ? inputTypes : [{type: config.parameters.type}];

        // Generate data.
        for (let i = 0; i < types.length; i++) {
            const options = typeof types[i] === 'string' ? {type: `${types[i]}`} : types[i];
            let key = 'value';

            if (Array.isArray((config.parameters.options || {}).types) && inputTypes.length > 0) {
                config.dataPropertyMappings[options.type] = options.type || 'value';
                key = options.type || 'value';
            }
            response.push(...generateData(res, key, options.type, options.value, options.min, options.max, options.decimals, range, options.interval));
        }

    } catch (err) {
        console.log(err.message);
    }
    return response;
};

/**
 * Inserts output from config.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    try {
        output.data = (config.authConfig.output || '${output}') !== '${output}' ? config.authConfig.output : output.data;
    } catch (err) {
        console.log(err.message);
        return output;
    }
    return output;
};

/**
 * Expose plugin methods.
 */
module.exports = {
    name: 'test',
    response,
    output,
};
