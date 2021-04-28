'use strict';
/**
 * Module dependencies.
 */
const router = require('express').Router();
const cache = require('../../app/cache');
const rp = require('request-promise');
const crypto = require('crypto');

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
function getTokenWithPassword(authConfig) {

    var token;

    const option = {
        method: 'POST',
        url: authConfig.url + authConfig.authPath,
        headers: {
            'Content-Type': 'application/json'
        },
        body: {

            email: authConfig.email,
            password: authConfig.password,

        },
        json: true,

    };
    return rp(option).then(function (result) {
        return Promise.resolve(result);
    }).catch(function (err) {
        return Promise.reject(err);
    });
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
            /** SmartWatcher Senaatti specific response handling. */
            if (authConfig.url === 'https://smartwatcher.northeurope.cloudapp.azure.com:4443/') {
                return updateToken(authConfig, true);
            } else {
                return updateToken(authConfig, false);
            }
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
        const pathType = (options.url.split("?")[0]).split("/")[8];
        const newpathType = config.dataPropertyMappings[pathType] != undefined ? config.dataPropertyMappings[pathType] : pathType
        options.url = options.url.replace(pathType, newpathType);
        config.measurementType = pathType;
        // Authorize request.
        options.headers.Authorization = 'Bearer ' + (grant.token);
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
        const combine = ([head, ...[headTail, ...tailTail]]) => {
            if (!headTail) return head;

            const combined = headTail.reduce((acc, x) => {
                return acc.concat(head.map(h => `{"id" : "${h}", "dataType": "${x}"}`))
            }, []);

            return combine([combined, ...tailTail]);
        }
        var combination = combine([parameters.ids, parameters.dataTypes]);
        parameters.ids = combination.map(JSON.parse);
        parameters.dataTypes = null;
        let startDate = parameters.start;
        let endDate = parameters.end;
        parameters.startTime = startDate.valueOf();
        parameters.endTime = endDate.valueOf();
        if (parameters.startTime && parameters.endTime) {
            // Sort timestamps to correct order.
            if (parameters.endTime < parameters.startTime) {
                const start = parameters.endTime;
                parameters.endTime = parameters.startTime;
                parameters.startTime = start;
            }
            let time = parameters.endTime - parameters.startTime;
            if (time <= 86400000) {

                return parameters;
            }
            else
                return promiseRejectWithError(500, 'Search interval must be less than 24 hours');
        }
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
    const tmp = {}
    tmp[config.measurementType] = data.type;
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
    for (var i = 0; i < data.length; i++) {
        data[i].timestamp = data[i]['time'];
        delete data[i].time;
    }
    return data;
};

module.exports = {
    name: 'smartwatcher',
    request,
    onerror,
    data,
    parameters,
    output,
    response,
};
