'use strict';
const rp = require('request-promise');

/**
* Manipulates request parameters.
*
* @param {Object} config
* @param {Object} parameters
* @return {Object}
*/
const parameters = async (config, parameters) => {
    try {

        if (parameters.ids && parameters.ids.length > 0) {
            return parameters;
        }
        else {
            parameters.ids = [''];
            return parameters;
        }
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
    return data;
}

/**
 * Sends getMaintainanceTaskInfo request .
 *
 * @param {Object} config
 * @return {Promise}
 */
function getMaintainanceTaskInfo(config, maintenanceTaskId) {

    try {

        const option = {
            method: 'GET',
            url: config.authConfig.url + config.authConfig.matainanceTaskPath + maintenanceTaskId,
            headers: config.authConfig.headers,
            json: true,
            resolveWithFullResponse: true,
        };
        return rp(option).then(function (result) {

            return Promise.resolve(result.body);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    } catch (err) {
        return Promise.reject(err);;
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
    let maintainanceTask = []
    for (let i = 0; i < output.data.sensors.length; i++) {
        for (let j = 0; j < output.data.sensors[i].measurements.length; j++) {
            let taskInfo = await getMaintainanceTaskInfo(config, output.data.sensors[i].measurements[j].result.maintenanceTaskId);
            maintainanceTask.push(taskInfo)
        }
    }

    result[config.output.object][config.output.array] = maintainanceTask;

    return result;
}

module.exports = {
    name: 'fatman',
    parameters,
    output,
    response,
};


