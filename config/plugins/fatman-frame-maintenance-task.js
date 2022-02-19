'use strict';
const rp = require('request-promise');
const _ = require('lodash');
const moment = require('moment');

/**
 * Splits period to start and end properties .
 *
 * @param {Object} config
 * @param {Object/String} parameters
 * @return {Object}
 */
const parameters = async (config, parameters) => {
    try {
        if (Object.hasOwnProperty.call(parameters, 'period')) {
            parameters.start = moment(parameters.period.split('/')[0]).format('YYYY-MM-DD');
            parameters.end = moment(parameters.period.split('/')[1]).format('YYYY-MM-DD');
            delete parameters.period;
        }
        return parameters;
    } catch (e) {
        return parameters;
    }
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
        if (options.url.includes("Building")) {
            options.url = options.url.replace("Building", "buildingId");
        } else if (options.url.includes("RealEstate")) {
            options.url = options.url.replace("RealEstate", "propertyId");
        } else {
            promiseRejectWithError(500, 'type of undefined');
        }
        return options;
    }
    catch (err) {
        return Promise.reject(err);
    }

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
 * Sends due dates request .
 *
 * @param {Object} config
 * @return {Promise}
 */
function getDueDatesInfo(config, maintenanceTaskId, task) {

    try {

        const option = {
            method: 'GET',
            url: config.authConfig.url + '/maintenance-task/maintenance-tasks/' + maintenanceTaskId + '/duedates',
            headers: config.authConfig.headers,
            qs: {
                "from": config.parameters.start,
                "to": config.parameters.end

            },
            json: true,
            resolveWithFullResponse: true,
        };
        return rp(option).then(async function (result) {
            let dueDates = []
            let statusAck = await getStatusInfo(config, maintenanceTaskId)
            result.body.forEach(item => {
                let obj = {}
                obj = {
                    "@type": "Process",
                    "idLocal": item.maintenanceTaskId.toString().concat("_", item.deadline),
                    "name": task.name,
                    "descriptionGeneral": task.description,
                    "additionalInformation": task.additionalInformation,
                    "scheduledEnd": item.deadline,
                    "status": []
                }
                let status = _.filter(statusAck, function (o) { return item.deadline == o.dueDate });

                if (status.length == 0) {
                    obj.status = [{
                        "@type": "Status",
                        "status": "Unhandled",
                        "updated": new Date(),
                        "comment": null,
                        "updater": null
                    }]
                }
                else {
                    status.forEach((x, i) => {
                        obj.status[i] = {
                            "@type": "Status",
                            "status": x.status,
                            "updated": x.time,
                            "comment": x.comment,
                            "updater": {
                                "@type": "Organization",
                                "idLocal": x.updater,
                                "name": x.updater
                            }
                        }
                    })
                }
                dueDates.push(obj)
            })
            return Promise.resolve(dueDates);
        }).catch(function (err) {
            return Promise.reject(err);
        });
    } catch (err) {
        return Promise.reject(err);;
    }
}

/**
 * Sends Status Ack request .
 *
 * @param {Object} config
 * @return {Promise}
 */
function getStatusInfo(config, maintenanceTaskId) {

    try {

        const option = {
            method: 'GET',
            url: config.authConfig.url + '/maintenance-task/maintenance-tasks/' + maintenanceTaskId + '/acknowledgements',
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
    for (let i = 0; i < output.data.maintenanceInformation.length; i++) {
        let maintainanceTaskIds = _.uniq(_.map(output.data.maintenanceInformation[i].measurements, 'value.maintenanceTaskId'));
        for (let j = 0; j < maintainanceTaskIds.length; j++) {
            if (maintainanceTaskIds[j] > 0) {
                let taskInfo = {}
                taskInfo['@type'] = "Process";
                let task = await getMaintainanceTaskInfo(config, maintainanceTaskIds[j]);
                let temp = {
                    idLocal: task.id,
                    name: task.name,
                    descriptionGeneral: task.description,
                    additionalInformation: task.additionalInformation,
                    executor: [
                        {
                            "@type": "Organization",
                            "idLocal": task.contractorId
                        }
                    ],
                    operator: [
                        {
                            "@type": "Organization",
                            "idLocal": task.responsibleId
                        }
                    ],
                    location: [
                        {
                            "@type": task.asset && task.asset.type,
                            "idLocal": task.asset && task.asset.id
                        },
                    ],
                    processInstance: await getDueDatesInfo(config, maintainanceTaskIds[j], task)
                }
                taskInfo = Object.assign(taskInfo, temp)
                maintainanceTask.push(taskInfo)
            }

        }
    }

    result[config.output.object][config.output.array] = maintainanceTask;

    return result;
}

module.exports = {
    name: 'fatman',
    request,
    output,
    response,
    parameters
};


