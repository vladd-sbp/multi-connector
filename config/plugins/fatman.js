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
    console.log(options)

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
        for (let j = 0; j < output.data.maintenanceInformation[i].measurements.length; j++) {
            if (output.data.maintenanceInformation[i].measurements[j].value.maintenanceTaskId > 0) {
                let taskInfo = {}
                taskInfo['@type'] = config.parameters.targetObject[i]['@type'];
                let task = await getMaintainanceTaskInfo(config, output.data.maintenanceInformation[i].measurements[j].value.maintenanceTaskId);
                let temp = {
                    idLocal:task.id,
                    name: task.name,
                    descriptionGeneral:task.description,
                    additionalInformation: task.additionalInformation,
                    executor: [
                        {
                            "@type": "Organization",
                            "idLocal":task.contractorId
                        }
                    ],
                    operator: [
                        {
                            "@type": "Organization",
                            "idLocal":task.contractorId
                        }
                    ],
                    location: [
                        {
                            "@type": config.parameters.targetObject[i]['@type'],
                            "idLocal": task.asset && task.asset.id
                        },
                    ],
                    processInstance: [
                        {
                            "@type": "Process",
                            "idLocal": output.data.maintenanceInformation[i].measurements[j].value.maintenanceTaskId.toString().concat("_", output.data.maintenanceInformation[i].measurements[j].value.dueDate),
                            "name": task.name,
                            "descriptionGeneral":task.description,
                            "additionalInformation": task.additionalInformation,
                            "status": [
                                {
                                    "@type": "Status",
                                    "status":output.data.maintenanceInformation[i].measurements[j].value.status,
                                    "updated": output.data.maintenanceInformation[i].measurements[j].value.time,
                                    "comment": output.data.maintenanceInformation[i].measurements[j].value.comment,
                                    "updater": {
                                        "@type": "Organization",
                                        "idLocal": output.data.maintenanceInformation[i].measurements[j].value.updater,
                                        "name": output.data.maintenanceInformation[i].measurements[j].value.updater
                                    }
                                }
                            ]
                        }
                    ]
                }
                taskInfo = Object.assign(taskInfo, temp)
                maintainanceTask.push(taskInfo)
            }
           
        }
    }

    // filter Based On status
    if (config.parameters.status && config.parameters.status.length > 0) {

        for (let x = 0; x < maintainanceTask.length; x++) {
            maintainanceTask = _.filter(maintainanceTask, function (o) { return config.parameters.status.includes(o["status"][0].status) });
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


