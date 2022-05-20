'use strict';
const _ = require('lodash');


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
        // Check for necessary information.
        if (!config.authConfig.username || !config.authConfig.password) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }

        var username = config.authConfig.username;
        var password = config.authConfig.password;
        var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
        options.rejectUnauthorized = false,
            options.headers = {
                "Authorization": auth,
            }
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
                        "@type": config.measurementType,
                        "timestamp": data.timestamp,
                        "value": (data.result.link_quality == '1.0' ? true : false)
                    }
                ],
                "id":  data.result.vendor_id
            })
        });
    });
    let vendorIds = config.parameters.ids.map(function (element) {
        return element.id;
    })
    // filter Based On ids
    if (vendorIds.length > 0) {
        arr = _.filter(arr, function (o) { return vendorIds.includes(o.id) });
    }

    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: arr,
        },
    };

    return result;
}


module.exports = {
    name: 'metropolia-parking-status',
    request,
    output,
    response
};