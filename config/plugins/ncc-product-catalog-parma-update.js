'use strict';
const rp = require('request-promise');

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
        options.body = Array.isArray(options.body) ? options.body : [options.body]
        options.json = true,
            options.body = {
                "elementGuid": options.body[0].elementGuid,
                "fabricationPlant": options.body[0].fabricationPlant === "null" ? null : options.body[0].fabricationPlant,
                "fabricationActualEndDate": options.body[0].fabricationActualEndDate
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

    return [JSON.parse(data.request.body)];
}

/**
 * Returns promise reject with error.
 *
 * @param {Number} [code]
 * @param {String} [msg]
 *   Error message
 * @param {String} [reference]
 *   Additional info about the cause of the error.
 * @return {Promise}
 */
const promiseRejectWithError = function (code, msg, reference) {

    const err = new Error(msg || 'Internal Server Error.');
    err.httpStatusCode = code || 500;
    err.reference = reference;
    return Promise.reject(err);
};


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    if (output.data.maintenanceInformation.length === 0) {
        return promiseRejectWithError(500, 'Incorrect Parameters');
    }
    if (config.parameters.targetObject.length > output.data.maintenanceInformation.length) {
        for (let i = 1; i < config.parameters.targetObject.length; i++) {
            const option = {
                method: 'POST',
                url: config.authConfig.url + config.authConfig.path,
                body: {
                    elementGuid: config.parameters.targetObject[i].elementGuid,
                    fabricationPlant: config.parameters.targetObject[i].fabricationPlant,
                    fabricationActualEndDate: config.parameters.targetObject[i].fabricationActualEndDate
                },
                headers: config.authConfig.headers,
                resolveWithFullResponse: true,
                query: [],
                gzip: true,
                encoding: null,
                json: true
            }
            await rp(option).then(function (result) {
                output.data.maintenanceInformation.push(
                    {
                        id: undefined, product: [{
                            value: JSON.parse(result.request.body)
                        }]
                    })
            }).catch(function (err) {
                return Promise.reject(err);
            });
        }
    }
    var arr = [];

    output.data.maintenanceInformation.forEach(function (item) {
        item.product.forEach((data) => {
            arr.push(data.value)

        });
    });


    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.data]: arr,
        },
    };

    return result;
}


module.exports = {
    name: 'ncc-product-catalog-parma-update',
    request,
    output,
    response
};