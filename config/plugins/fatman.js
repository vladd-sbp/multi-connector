'use strict';
const rp = require('request-promise');
const _ = require('lodash');


/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) => {
    if (data.length == 0)
        return [{ "maintenanceTaskId": 0 }]
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
    for (let i = 0; i < output.data.serviceRequest.length; i++) {
        for (let j = 0; j < output.data.serviceRequest[i].measurements.length; j++) {
            let taskInfo = {}
            taskInfo['@type'] = "Case";
            taskInfo.idLocal = config.parameters.ids[i].id;
            if (output.data.serviceRequest[i].measurements[j].value.maintenanceTaskId > 0) {
                taskInfo.status = output.data.serviceRequest[i].measurements[j].value.status;
                let task = await getMaintainanceTaskInfo(config, output.data.serviceRequest[i].measurements[j].value.maintenanceTaskId);
                taskInfo = Object.assign(taskInfo, task)
            }
            maintainanceTask.push(taskInfo)
        }
    }

     // filter Based On taskStatus
     if (config.parameters.taskStatus && config.parameters.taskStatus.length > 0) {

        for (let x = 0; x < maintainanceTask.length; x++) {
            maintainanceTask = _.filter(maintainanceTask, function (o) { return config.parameters.taskStatus.includes(o["status"]) });
        }
    }else{
        for (let x = 0; x < maintainanceTask.length; x++) {
            maintainanceTask = _.filter(maintainanceTask, function (o) { return o.hasOwnProperty("status") });
        }
    }
    
    result[config.output.object][config.output.array] = maintainanceTask;

    return result;
}

module.exports = {
    name: 'fatman',
    output,
    response,
};


