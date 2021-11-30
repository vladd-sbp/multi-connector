'use strict';
/**
 * Module dependencies.
 */
const router = require('express').Router();
const cache = require('../../app/cache');
const rp = require('request-promise');
const crypto = require('crypto');
const winston = require('../../logger');
const mrequest = require('request');

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

    var token;

    const option = {
        method: 'GET',
        url: authConfig.url + authConfig.authPath,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        qs: {
            userName: authConfig.email,
            password: authConfig.password,
            grantType: authConfig.grantType,
            format: authConfig.format,
        },
        json: true,

    };

    try {
        
        const token = await makeRequest(`https://nuukacustomerwebapi.azurewebsites.net/api/v2.0/ClientToken?userName=tapio.toivanen@eeneman.com&password=Tue0110_Cit5&grantType=password&format=json`);
        return Promise.resolve({ token });
    } catch (err) {
        console.error(err);
        return Promise.reject(err);
    }
    // return rp(option).then(function (result) {
    //     console.log("my token auth:", result);
    //     return Promise.resolve({token: result});
    // }).catch(function (err) {
    //     console.log("my token error:", err);
    //     return Promise.reject(err);
    // });
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

        // const pathType = (options.url.split("?")[0]).split("/")[8];
        // const newpathType = config.dataPropertyMappings[pathType] != undefined ? config.dataPropertyMappings[pathType] : pathType
        // options.url = options.url.replace(pathType, newpathType);
        // config.measurementType = pathType;
        // Authorize request.
        // options.headers.Authorization = grant.token;
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
        // const combine = ([head, ...[headTail, ...tailTail]]) => {
        //     if (!headTail) return head;

        //     const combined = headTail.reduce((acc, x) => {
        //         return acc.concat(head.map(h => `{"id" : "${h}", "dataType": "${x}"}`))
        //     }, []);

        //     return combine([combined, ...tailTail]);
        // }
        // var combination = combine([parameters.ids, parameters.dataTypes]);
        // parameters.ids = combination.map(JSON.parse);
        parameters.dataTypes = null;
        let startDate = parameters.start;
        let endDate = parameters.end;
        parameters.startTime = parameters.start;//startDate.valueOf();
        parameters.endTime = parameters.end;//endDate.valueOf();
        return parameters;
        // if (parameters.startTime && parameters.endTime) {
        //     // Sort timestamps to correct order.
        //     if (parameters.endTime < parameters.startTime) {
        //         const start = parameters.endTime;
        //         parameters.endTime = parameters.startTime;
        //         parameters.startTime = start;
        //     }
        //     let time = parameters.endTime - parameters.startTime;
        //     // if (time <= 86400000) {

        //         return parameters;
        //     // }
        //     // else
        //         // return promiseRejectWithError(500, 'Search interval must be less than 24 hours');
        // }
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
    // console.log("dat:", data);
    tmp[config.measurementType[`${data.type}`]] = data.value;
    // tmp[config.dataPropertyMappings.GroupDescription] = data.GroupDescription;
    // tmp[config.dataPropertyMappings.InformationID] = data.InformationID;
    // tmp[config.dataPropertyMappings.Unit] = data.Unit;
    return tmp;
};

const getTimeDiff = (date) => {
    let timezone_offset_min = date.getTimezoneOffset(),
        offset_hrs = parseInt(Math.abs(timezone_offset_min / 60)),
        offset_min = Math.abs(timezone_offset_min % 60),
        timezone_standard;

    if (offset_hrs < 10)
        offset_hrs = '0' + offset_hrs;

    if (offset_min < 10)
        offset_min = '0' + offset_min;

    // Add an opposite sign to the offset
    // If offset is 0, it means timezone is UTC
    if (timezone_offset_min <= 0)
        timezone_standard = '+' + offset_hrs + ':' + offset_min;
    else if (timezone_offset_min > 0)
        timezone_standard = '-' + offset_hrs + ':' + offset_min;
    else if (timezone_offset_min == 0)
        timezone_standard = 'Z';

    let dt = date,
        current_date = dt.getDate(),
        current_month = dt.getMonth() + 1,
        current_year = dt.getFullYear(),
        current_hrs = dt.getHours(),
        current_mins = dt.getMinutes(),
        current_secs = dt.getSeconds(),
        current_datetime;

    // Add 0 before date, month, hrs, mins or secs if they are less than 0
    current_date = current_date < 10 ? '0' + current_date : current_date;
    current_month = current_month < 10 ? '0' + current_month : current_month;
    current_hrs = current_hrs < 10 ? '0' + current_hrs : current_hrs;
    current_mins = current_mins < 10 ? '0' + current_mins : current_mins;
    current_secs = current_secs < 10 ? '0' + current_secs : current_secs;

    // Current datetime
    // String such as 2016-07-16T19:20:30
    current_datetime = current_year + '-' + current_month + '-' + current_date + 'T' + current_hrs + ':' + current_mins + ':' + current_secs;

    // Timezone difference in hours and minutes
    // String such as +5:30 or -6:00 or Z
    return current_datetime + timezone_standard;
}


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
                date.timestamp = getTimeDiff(date.timestamp);
            });

            // console.log(getTimeDiff(item.measurements[1].timestamp));

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
            console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            console.log('body:', body); // Print the HTML for the Google homepage.
            return resolve(JSON.parse(body));
        });
    });
}

module.exports = {
    name: 'sensor',
    request,
    onerror,
    data,
    parameters,
    output,
    response,
};
