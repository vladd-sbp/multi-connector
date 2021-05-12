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
        // Check for necessary information.
        if (!config.authConfig.authPath || !config.authConfig.url) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }
        var username = config.authConfig.username;
        var password = config.authConfig.password;
        //creating authorization
        var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        options.headers = {
            "Authorization" : auth,
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
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data)=>{
    return data.body;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
 const output = async (config, output) => {
    output.data.file = output.data.sensors[0].data[0].value.toString('base64');
    delete output.data.sensors;
    return output;
}

module.exports = {
    name: 'vastuu',
    request,
    output,
    response,
};