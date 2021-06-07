'use strict';
/**
 * Module dependencies.
 */
const cache = require('../../app/cache');
const rp = require('request-promise');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');


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
    // function loginUser(authConfig){
    var authenticationdata={
    Username : authConfig.username,
    Password : authConfig.password,
    };

    var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationdata);

    var poolData = {
        UserPoolId: authConfig.UserPoolId,
        ClientId: authConfig.ClientId,
    };

    var userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    var userData = {
    Username :authConfig.username,
    Pool : userPool,
    };


    var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    return new Promise(function(resolve, reject){
    cognitoUser.authenticateUser(authenticationDetails,{
    onSuccess : resolve,
    onFailure : reject,
    });
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
const requestToken = async (authConfig,refresh) => {
    // Get grant from cache (only for refresh purposes)
    let grant;
    grant = cache.getDoc('grants', authConfig.username);
    if (!grant) grant = {};
    return (authConfig ? getTokenWithPassword(authConfig) : authConfig).then(function (result) {
        if (result) {
            cache.setDoc('grants', authConfig.username, result);
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
            if (authConfig.url === 'https://sense-api.vilpe.com') {
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
        if (!config.authConfig.UserPoolId || !config.authConfig.url) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }

        // Check for existing grant.
        let grant = cache.getDoc('grants', config.authConfig.username); //changed product code to username
        if (!grant && config.authConfig.headers.Authorization) grant = { Token: config.authConfig.headers.Authorization };
        if (!grant) grant = {};

        if (Object.hasOwnProperty.call(grant, 'idToken')) {
            const ts = Date.now()+10000;
            const expiry = grant.idToken.payload.exp*1000;
            if (ts > expiry) {
                grant = await requestToken(config.authConfig);
                if (!grant.idToken) return promiseRejectWithError(500, 'Authentication failed.');
            }
        } else {
           // Request access token.
            grant = await requestToken(config.authConfig);
            if (!grant.idToken) return promiseRejectWithError(500, 'Authentication failed.');
        }

        var token = grant.idToken.jwtToken;

        // Authorize request.
        options.headers.Authorization = 'Bearer ' + token;
        options.json = true;
        return options;

    }
    catch (err) {
        return Promise.reject(err);
    }

};

/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) =>{
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

    if (output.data.indoorAirQuality.length === 0) {
        return promiseRejectWithError(500, 'Incorrect Parameters');
    }
    else {
        var arr = [];
        var properties = {
                "fan_rpm": "Speed",
                "mold_index": "Mold",
                "relative_humidity": "Humidity",
                "temperature": "Temperature"
        }

        output.data.indoorAirQuality[0].measurements[0].value.valueTypes.forEach(function (item){
            let measurementType = item.identifier;
            arr.push({
                "@type": "Measure",
                "processValue": item.value.toString(),
                "exactTime": new Date(item.timestamp),
                "executor":{
                    "@type":"Organization",
                    "name": output.data.indoorAirQuality[0].measurements[0].value.name,
                    "idLocal": output.data.indoorAirQuality[0].measurements[0].value.deviceId.toString()
                    },
                    "location":{},
                    "processTarget": "Air",
                    "physicalProperty": properties[item.identifier],
                    "unitOfMeasure":config.measurementUnit[measurementType] != undefined ? config.measurementUnit[measurementType] : measurementType
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
}

module.exports = {
    name: 'vilpe',
    request,
    onerror,
    output,
    response,
};
