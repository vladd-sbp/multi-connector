'use strict';

/**
 * Composes authorization header and
 * includes it to the http request options.
 *
 * @param {Object} config
 * @param {Object} options
 * @return {Object}
 */
const request = async (config, options) => {
    try {
        return options;
    }
    catch (err) {
        return Promise.reject(err);
    }
}


/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} data
 * @return {Object}
 */
const response = async (config, data) => {
    return data;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    var arr = [];

    output.data.sensors.forEach(function (item) {

        item.measurements.forEach((data) => {
            arr.push({
                "measurements": [
                    {
                        "@type": data.result.Component,
                        "timestamp": data.timestamp,
                        "value": data.result.Value
                    }
                ],
                "id":  data.result.Tag
            })
        });
    });
   

    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: arr,
        },
    };

    return result;
}



module.exports = {
    name: 'stavanger',
    request,
    output,
    response
};