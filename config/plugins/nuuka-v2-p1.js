'use strict';
/**
 * Module dependencies.
 */
const cache = require('../../app/cache');
const winston = require('../../logger');
const mrequest = require('request');
const moment = require('moment')
/**
 * OAuth2 authentication plugin.
 */

// Store failed authorization attempts.
const failures = {};

/**
 * Returns promise reject with error.
 *
 * @param {Number} [code]
 * @param {String} [msg]
 *   Error message.
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
 * Attempts to update access token.
 *
 * @param {Object} authConfig
 * @param {Boolean} [refresh]
 *   Whether refresh token should be used or not.
 * @return {Promise/PromiseRejectionEvent}
 *    Returns promise resolve if grant was updated successfully.
 */
const updateToken = async (authConfig, refresh) => {
    // Create a property for attempt count, which will be used to limit the number of update attempts.
    if (!Object.hasOwnProperty.call(authConfig, 'attempt')) {
        authConfig.attempt = 0;
    }

    authConfig.attempt++;

    // Limit the number of attempts after error to 3 times.
    if (authConfig.attempt) {
        if (authConfig.attempt > 3) {
            return promiseRejectWithError(500, 'Authentication failed.');
        }
    }

    // Request new token with selected grant type.
    const grant = refresh ? await requestToken(authConfig, true) : await requestToken(authConfig);
    if (!grant) return promiseRejectWithError(500, 'Authentication failed.');
    return Promise.resolve();
};

/**
 * Sends authentication request with credentials.
 *
 * @param {Object} authConfig
 * @return {Promise}
 */
async function getTokenWithPassword(authConfig) {

    try {
        const authurl = `${authConfig.url}/api/v2.0/ClientToken?userName=${authConfig.email}&password=${authConfig.password}&grantType=password&format=json`;
        const token = await makeRequest(authurl);
        return Promise.resolve({ token });
    } catch (err) {
        console.error(err);
        return Promise.reject(err);
    }
}


/**
 * Initiates request to acquire access token.
 *
 * @param {Object} authConfig
 * @param {Boolean} [refresh]
 *   Whether refresh token should be used or not.
 * @return {Promise} Grant
 */
const requestToken = async (authConfig, refresh) => {

    // Get grant from cache (only for refresh purposes)
    let grant;
    grant = cache.getDoc('grants', authConfig.productCode);
    if (!grant) grant = {};
    return (authConfig ? getTokenWithPassword(authConfig) : authConfig).then(function (result) {
        let token;
        if (result) {
            cache.setDoc('grants', authConfig.productCode, result);
            return Promise.resolve(result);
        }
        return Promise.resolve();
    }).catch(function (err) {
        return onerror(authConfig, err).then(function (result) {
            /** Second attempt was successful. */
            return Promise.resolve(result);
        }).catch(function (err) {
            /** Second attempt failed. */
            return Promise.reject(err);
        });
    });
};

/**
 * Handles erroneous response.
 *
 * @param {Object} authConfig
 * @param {Error} err
 * @return {Promise}
 */
const onerror = async (authConfig, err) => {
    /** Internal error. */
    if (err.reference) {
        return promiseRejectWithError(err.statusCode, err.message);
    }

    /** External error. */
    switch (err.statusCode) {
        /** 401 - Unauthorized. */
        case 401:
            return updateToken(authConfig, false);

        /** 403 - Token expired. */
        case 403:
            return updateToken(authConfig, true);
        /** 400 - Invalid credentials / Access token is missing */
        case 400:
            return promiseRejectWithError(err.statusCode, 'Authentication failed.');
    }
    return promiseRejectWithError(err.statusCode, 'Authentication failed.');
};

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
        // Check for existing grant.
        let grant = cache.getDoc('grants', config.authConfig.productCode);
        if (!grant && config.authConfig.headers.Authorization) grant = { token: config.authConfig.headers.Authorization };
        if (!grant) grant = {};
        if (!Object.hasOwnProperty.call(grant, 'token')) {
            // Request access token.
            grant = await requestToken(config.authConfig);
            if (!grant.token) return promiseRejectWithError(500, 'Authentication failed.');
        }

        config.authConfig.headers.Authorization = grant.token;
        return options;
    }
    catch (err) {
        return Promise.reject(err);
    }

};

/**
 * Manipulates request parameters.
 *
 * @param {Object} config
 * @param {Object} parameters
 * @return {Object}
 */
const parameters = async (config, parameters) => {
    try {
        parameters.dataTypes = parameters.dataTypes.map((dataType) => {
            return config.static.dataTypes[dataType];
        }).join(",");
        parameters.startTime = parameters.start;
        parameters.endTime = parameters.end;
        return parameters;
    } catch (err) {
        return promiseRejectWithError(500, 'Search interval must be less than 24 hours');
    }
};


/**
 * Response data Mapping
 *
 * @param {Object} config
 * @param {Object} data
 * @return {Object}
 */
const data = async (config, data) => {
    const tmp = {};
    tmp[config.measurementType[`${data.type}`]] = data.value;
    return tmp;
};

/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {

    if (output.data.sensors.length === 0) {
        return promiseRejectWithError(500, 'Incorrect Parameters');
    }
    else {
        var arr = [];
        output.data.sensors.forEach(function (item) {

            item.measurements.forEach((date) => {
                date.timestamp = moment(date.timestamp).local().format();               
            });

            var existing = arr.filter(function (v, i) {
                return v.id == item.id;
            });
            if (existing.length) {
                var existingIndex = arr.indexOf(existing[0]);
                arr[existingIndex].measurements = arr[existingIndex].measurements.concat(item.measurements);
            } else {
                arr.push(item);
            }
        });

        const result = {
            [config.output.context]: config.output.contextValue,
            [config.output.object]: {
                [config.output.array]: [],
            },
        };
        for (let i = 0; i < arr.length; i++) {
            result[config.output.object][config.output.array].push(arr[i]);
        }
        return result;
    }
}

/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) => {

    try {
        // nuuka api call
        const res = await makeRequest(`${config.authConfig.url}${data}
        &$token=${config.authConfig.headers.Authorization}`);

        return res;
    } catch (err) {
        winston.log('error', err);
        return promiseRejectWithError(err.statusCode, err.message);
    }
};

const makeRequest = (url) => {
    return new Promise((resolve, reject) => {
        mrequest(url, (error, response, body) => {
            if (error) {
                console.error('error:', error); // Print the error if one occurred
                return reject(error);
            }
            if (!response || response.statusCode !=200) {
                if (response) {
                    return reject (response);
                }
            }
            return resolve(JSON.parse(body));
        });
    });
}

module.exports = {
    name: 'nuuka-v2-p1',
    request,
    onerror,
    data,
    parameters,
    output,
    response,
};
