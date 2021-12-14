'use strict';

const rp = require('request-promise');
const cache = require('../../app/cache');
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
        if (!config.authConfig.authPath || !config.authConfig.url) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }
        // Check for existing grant.
        let grant = cache.getDoc('grants', config.authConfig.productCode);
        if (!grant && config.authConfig.token) grant = { token: config.authConfig.token };
        if (!grant) grant = {};
        if (!Object.hasOwnProperty.call(grant, 'token')) {
            // Request access token.
            grant = await requestToken(config.authConfig);
            if (!grant.token) return promiseRejectWithError(500, 'Authentication failed.');
        }
        config.authConfig.token = grant.token;
        options.url=options.url+`&$token=${grant.token}`
        for(var i=0;i<config.authConfig.measurementInfoPath.length;i++){
            config.authConfig.measurementInfoPath[i]=config.authConfig.measurementInfoPath[i]+`&$token=${grant.token}`
        }
       
        return options;
    }
    catch (err) {
        return Promise.reject(err);
    }

};

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
      return rp(option).then(function (result) {
       
        return Promise.resolve({token: result});
    }).catch(function (err) {
       
        return Promise.reject(err);
    });
  
}

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

    return promiseRejectWithError(err.statusCode, 'Authentication failed.');
};

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
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) => {

    return data;
}

/**
 * Sends getMeasurementInfo request .
 *
 * @param {Object} config
 * @return {Promise}
 */
function getMeasurementInfoFromAPi(config, dataPointID) {
    
    try{
        for (let i = 0; i < config.parameters.ids.length; i++) {
            if (config.parameters.ids[i].dataPointId == dataPointID) {
                var tempPath = config.authConfig.measurementInfoPath[i]
            }
        }
        const option = {
            method: 'GET',
            url: config.authConfig.url + tempPath,
            json: true,
            resolveWithFullResponse: true,
        };
        return rp(option).then(function (result) {
            let dataProducts;
            dataProducts = cache.getDoc('dataProducts', config.authConfig.productCode);
            if (!dataProducts) dataProducts = [];
            var categoryObj = _.find(result.body, { 'DataPointID': dataPointID });
            dataProducts.push(categoryObj)
            cache.setDoc('dataProducts', config.authConfig.productCode, dataProducts);
            return Promise.resolve(categoryObj);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    }catch (err) {
    return Promise.reject(err);;
    }
}


/**
 * checks if dataExists in Cache .
 *
 * @param {Object} config
 * @return {Promise}
 */
async function getMeasurementInfo(config, dataPointID) {
    let dataProducts;
    dataProducts = cache.getDoc('dataProducts', config.authConfig.productCode);
    if (!dataProducts) dataProducts = [];
    if (dataProducts.length > 0) {
        var categoryObj = _.find(dataProducts, { 'DataPointID': dataPointID });
        if (categoryObj == undefined) {
            categoryObj = await getMeasurementInfoFromAPi(config, dataPointID)
        }
        return Promise.resolve(categoryObj);
    }
    else {
        var categoryObj = await getMeasurementInfoFromAPi(config, dataPointID)
        return Promise.resolve(categoryObj);
    }
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

    let sensors = [];
    for (let i = 0; i < output.data.sensors.length; i++) {
        let measureType = [];
        let dataPointId;
        for (let j = 0; j < output.data.sensors[i].measurements.length; j++) {
            dataPointId = output.data.sensors[i].measurements[j].result.DataPointID;
            let measurementInfo = await getMeasurementInfo(config, output.data.sensors[i].measurements[j].result.DataPointID);
            let measurementType = measurementInfo ? measurementInfo.Category : output.data.sensors[i].measurements[j].result.DataPointID;
            measureType.push({
                "@type": config.measurementUnit[measurementType] != undefined ? config.measurementUnit[measurementType] : measurementType,
                "timestamp": output.data.sensors[i].measurements[j].result.Timestamp,
                "value": output.data.sensors[i].measurements[j].result.Value
            });
        }
        let id =  _.find(config.parameters.ids, { 'dataPointId': `${dataPointId}` });
        sensors.push({ 'measurements': measureType, 'id': { 'buildingId': id.buildingId, 'dataPointId': id.dataPointId } });
    }
    // filter Based On dataTypes
    if (config.parameters.dataTypes && config.parameters.dataTypes.length > 0) {

        for (let x = 0; x < sensors.length; x++) {
            sensors[x].measurements = _.filter(sensors[x].measurements, function (o) { return config.parameters.dataTypes.includes(o["@type"]) });
        }
    }else{
        for (let x = 0; x < sensors.length; x++) {
            sensors[x].measurements = _.filter(sensors[x].measurements, function (o) { return config.defaultDataTypes.includes(o["@type"]) });
        }
    }
    // remove Measurements if its Empty Array
    let filterData = []
    for (let y = 0; y < sensors.length; y++) {
        if (sensors[y].measurements.length > 0)
            filterData.push(sensors[y])
    }

    result[config.output.object][config.output.array] = filterData;

    return result;
}

module.exports = {
    name: 'nuuka2',
    request,
    onerror,
    output,
    response
};


