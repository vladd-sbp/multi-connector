'use strict';
/**
 * Module dependencies.
 */
const router = require('express').Router();
const cache = require('../../app/cache');
const rp = require('request-promise');
const crypto = require('crypto');
const tough = require('tough-cookie');
const Cookie = tough.Cookie;
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
const updateCookie = async (authConfig, refresh) => {
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
    const grant = refresh ? await requestCookie(authConfig, true) : await requestCookie(authConfig);
    if (!grant) return promiseRejectWithError(500, 'Authentication failed.');
    return Promise.resolve();
};

/**
 * Sends authentication request with credentials.
 *
 * @param {Object} authConfig
 * @return {Promise}
 */
function getCookieWithPassword(authConfig) {
   
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
        resolveWithFullResponse: true,
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
const requestCookie = async (authConfig, refresh) => {
    // Get grant from cache (only for refresh purposes)
    
    let grant;
    grant = cache.getDoc('grants', authConfig.productCode);
    if (!grant) grant = {};
    return (authConfig ? getCookieWithPassword(authConfig) : authConfig).then(function (result) {
        
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
            if (authConfig.url === 'https://iisycloud.fi/rest/') {
                return updateCookie(authConfig, true);
            } else {
                return updateCookie(authConfig, false);
            }
        /** 403 - Token expired. */
        case 403:
            return updateCookie(authConfig, true);
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
    // Check for necessary information.
    if (!config.authConfig.authPath || !config.authConfig.url) {
        return promiseRejectWithError(500, 'Insufficient authentication configurations.');
    }
    // Check for existing grant.
    let grant = cache.getDoc('grants', config.authConfig.productCode);
    if (!grant && config.authConfig.headers.Cookie) grant = { Cookie: config.authConfig.headers.Cookie };
    if (!grant) grant = {};
    if (!Object.hasOwnProperty.call(grant, 'headers')) {
        // Request access token.
        grant = await requestCookie(config.authConfig);
        if (!grant.headers) return promiseRejectWithError(500, 'Authentication failed.');
    }
    const cookie = Cookie.parse(grant.headers['set-cookie'][0]);
    var authToken = (cookie.cookieString().split("=")[1]);
   
    // Authorize request.
    options.headers = {
        "authToken": authToken,
        "Cookie": cookie.cookieString(),
        "Content-Type": "application/json"
    }
    options.json = true;
    return options;
};

/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) => {
    let measurementData = JSON.parse(JSON.stringify(data.body)).content[0];
    return measurementData;


}

/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {

    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: [],
        },
    };
    let measurement = [];
    // Hand over data objects to transformer.

    const array = output.data.content[0].measurements[0].value;

    for (let i = 0; i < array.measurementUnitData.length; i++) {
        let measurements = [];
        for (let k = 0; k < array.measurementUnitData[i]['measurementPointData'].length; k++) {
            let data = array.measurementUnitData[i]['measurementPointData'][k]['measurementData']
            for (let j = 0; j < data.length; j++) {
                let measurementType = array.measurementUnitData[i]['measurementPointData'][k]['measurementPoint'];
                measurements.push({ '@type': config.measurementUnit[measurementType] != undefined ? config.measurementUnit[measurementType] : measurementType, 'timestamp': data[j]['time'], 'value': data[j]['value'] });

            }
        }

        measurement.push({ 'id': array.measurementUnitData[i]['measurementUnit']['id'], 'measurements': measurements })
    }
    for (let i=0;i<measurement.length;i++){
    result[config.output.object][config.output.array].push(measurement[i]);
    }
    return result;
}


module.exports = {
    name: 'kerava',
    request,
    onerror,
    response,
    output,
};
