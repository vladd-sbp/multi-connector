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
    let cookieExpired = true ;

    // Check for necessary information.
    if (!config.authConfig.authPath || !config.authConfig.url) {
        return promiseRejectWithError(500, 'Insufficient authentication configurations.');
    }
    // Check for existing grant.
    let grant = cache.getDoc('grants', config.authConfig.productCode);

    if (grant != undefined) {
        let  ts = Date.parse(grant.body.lastLogin);
        let cookieTime = new Date() - ts;
        cookieExpired = (cookieTime >  43200000 ? true : false);  // set cookie false after 12hr
    }


    if (!grant && config.authConfig.headers.Cookie) grant = { Cookie: config.authConfig.headers.Cookie };
    if (!grant) grant = {};
   // if (!Object.hasOwnProperty.call(grant, 'headers')) {

    if ( cookieExpired) {
        // Request access token.
        grant = await requestCookie(config.authConfig);
        if (!grant.headers) {
            return promiseRejectWithError(500, 'Authentication failed.');
        }
    }

    const cookie = Cookie.parse(grant.headers['set-cookie'][0]);
    var authToken = (cookie.cookieString().split("=")[1]);

    // Authorize request.
    options.headers = {
        "authToken": authToken,
        "Cookie": cookie.cookieString(),
        "Content-Type": "application/json"
    }
    options.body = {
        "idOfLocation": options.body.idOfLocation,
        "start": options.body.start,
        "end": options.body.end
    }
    options.json = true;
    return rp(options).then(function (result) {
        return Promise.resolve(result);
    }).catch(function (err) {
        if (Object.hasOwnProperty.call(err, 'statusCode')) {
            if (err.statusCode === 404 || err.statusCode === 400) {
                return Promise.resolve([]);
            }
        }
        return handleError(config, err).then(function () {
            /** Second attempt */
            // If error handler recovers from the error, another attempt is initiated.
            return request(config, options);
        }).then(function (result) {
            // Handle received data.
            if (result !== null) return Promise.resolve(result);
            // Handle connection timed out.
            return promiseRejectWithError(522, 'Connection timed out.');
        }).then(function (result) {
            // Return received data.
            return Promise.resolve(result);
        }).catch(function (err) {
            if (Object.hasOwnProperty.call(err, 'statusCode')) {
                if (err.statusCode === 404 || err.statusCode === 400) {
                    return Promise.resolve([]);
                }
            }
            return Promise.reject(err);
        });

    });
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
        parameters.startTime = parameters.start;
        parameters.endTime = parameters.end;
        return parameters;
    } catch (err) {
        return parameters;
    }
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
};

/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    let dataArray = [];
    const data = config.authConfig.body;
    if (!Array.isArray(data)) dataArray.push(data);
    else dataArray = data;

    var merged = [].concat.apply([], dataArray);
    let items = [];
    items = await getData(config, merged);
    if (!items) items = [];

    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: [],
        },
    };

    let measurement = [];
    // Hand over data objects to transformer.
    for (let x = 0; x < items.length; x++) {
        const array = items[x];
        var idOfLocation = array.location.idOfLocation;

        for (let i = 0; i < array.measurementUnitData.length; i++) {
            let measurements = [];
            for (let k = 0; k < array.measurementUnitData[i]['measurementPointData'].length; k++) {
                let data = array.measurementUnitData[i]['measurementPointData'][k]['measurementData'];
                for (let j = 0; j < data.length; j++) {
                    let time = data[j]['time'];
                    let time1 = time.valueOf();
                    let measurementType = array.measurementUnitData[i]['measurementPointData'][k]['measurementPoint'];
                    measurements.push({ '@type': config.measurementUnit[measurementType] != undefined ? config.measurementUnit[measurementType] : measurementType, 'timestamp': new Date(data[j]['time']), 'value': data[j]['value'] });
                }
            }

            let measureType = [];
            for (let i = 0; i < measurements.length; i++) {
                for (let j = 0; j < config.parameters.dataTypes.length; j++) {
                    if (measurements[i]['@type'] === config.parameters.dataTypes[j]) {
                        measureType.push(measurements[i]);
                    }
                }
            }
            measurement.push({ 'id': { 'idOfLocation': idOfLocation, 'idOfSensor': array.measurementUnitData[i]['measurementUnit']['id'],'name': array.measurementUnitData[i]['measurementUnit']['name'] }, 'measurements': measureType });
        }
    }

    const map = {};
    const measurementFilter = [];
    measurement.forEach(el => {
        if (!map[JSON.stringify(el)]) {
            map[JSON.stringify(el)] = true;
            measurementFilter.push(el);
        }
    });

//Create loation
let props = config.dataPropertyMappings;
let location = {"@type":"Location"};
let locationDetails = items[0].location;

    if(locationDetails){
     for( const item in locationDetails){
        if(props[item]){
            if(item == 'coordinates'){
                location[props[item]] = {};
                location[props[item]]['@type'] = 'LocationPoint';
                location[props[item]]['location'] =[];
                location[props[item]]['location'].push({"@type": "Location", "longitude": locationDetails[item][0], "latitude": locationDetails[item][1]});
            }
            else if(locationDetails[item] != ''){
                location[props[item]] = locationDetails[item];
            }
        }
     }
    }

    for (let i = 0; i < measurementFilter.length; i++) {
        result[config.output.object][config.output.array].push(measurementFilter[i]);
    }
    result[config.output.object][config.output.array].push(location);
    return result;
}

/**
 * Initiates data requests.
 *
 * @param {Object} config
 * @param {String} pathArray
 *   Resource path, which will be included to the resource url.
 * @return {Array}
 */
const getData = async (config, dataArray) => {
    const itemse = [];

    for (let p = 0; p < dataArray.length; p++) {
        const item = await requestData(config, dataArray[p], p);
        if (item) itemse.push(item);
    }
    return itemse;
};

/**
 * Structures required information for data request.
 *
 * @param {Object} config
 * @param {String} path
 *   Resource path, which will be included to the request.
 * @param {Number} index
 * @return {Promise}
 */
const requestData = async (config, path, index) => {
    let idOfSensor = path.ids.idOfSensor;
    var path = {
        "idOfLocation": path.ids.idOfLocation,
        "start": path.start,
        "end": path.end
    }

    // Initialize request options.
    let options = {
        method: config.authConfig.method || 'GET',
        url: config.authConfig.url + config.authConfig.path,
        body: path || undefined,
        headers: config.authConfig.headers || {},
        resolveWithFullResponse: true,
        query: [],
        gzip: true,
        encoding: null,
    };

    let outputData = await request(config, options);
    let responses = await response(config, outputData);
    var location = responses.location;
    var measurementUnitData = responses.measurementUnitData;
    let measurementData = [];
    for (let i = 0; i < measurementUnitData.length; i++) {
        if (measurementUnitData[i].measurementUnit.id == idOfSensor) {
            measurementData.push(measurementUnitData[i]);
        }
    }

    var itemData = {
        "location": location,
        "measurementUnitData": measurementData
    }

    return itemData;
}
/**
 * Handles erroneous response.
 *
 * @param {Object} config
 * @param {Error} err
 * @return {Promise}
 */
const handleError = async (config, err) => {
    winston.log('info', config.authConfig.template + ': Response with status code ' + err.statusCode);
    /** Connection error handling. */
    if (err.statusCode === 500
        || err.statusCode === 502
        || err.statusCode === 503
        || err.statusCode === 504
        || err.statusCode === 522
    ) {
        return promiseRejectWithError(err.statusCode, err.message);
    }

    // Execute onerror plugin function.
    return await onerror(config, err);
};
module.exports = {
    name: 'kerava-indoor',
    onerror,
    output,
    parameters,
};
