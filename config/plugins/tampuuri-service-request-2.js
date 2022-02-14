'use strict';

const moment = require('moment');
const rp = require('request-promise');

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
        return options;
    }
    catch (err) {
        return Promise.reject(err);
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
        if (config.parameters.start && config.parameters.end) {
            var startYear = moment(config.parameters.start, 'YYYY-MM-DD');
            var endYear = moment(config.parameters.end, 'YYYY-MM-DD');
            let diff = endYear.diff(startYear, 'years');
            if (diff > 0 && data.KohdeId) {
                for (var i = 0; i < diff; i++) {
                    var nextYearData = await getDataFromAPi(config, data.KohdeId, moment(startYear).add(1, 'years').format('YYYY-MM-DD'))
                    data.Tehtavat = data.Tehtavat.concat(nextYearData.body.Tehtavat)
                }
                return data;
            }
            else {
                return data;
            }
        }
    } catch (err) {
        return Promise.reject(err);
    }

}

/**
 * Sends getDataFromAPi request .
 *
 * @param {Object} config
 * @return {Promise}
 */
async function getDataFromAPi(config, KohdeId, Year) {
    try {
        var tempPath = "/huoltokirja/huoltokalenteri?KohdeId=" + KohdeId + "&Vuosi=" + Year
        const option = {
            method: 'GET',
            url: config.authConfig.url + tempPath,
            headers: config.authConfig.headers,
            json: true,
            resolveWithFullResponse: true,
        };
        return rp(option).then(function (result) {

            return Promise.resolve(result);
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
    var arr = [];
    output.data.maintenanceInformation.forEach(function (item) {
        item.measurements[0].value.Tehtavat.forEach(function (obj) {
            let processInstance = forProcessInstance(obj.Nimi, obj.Toimenpiteet, config)
            if (processInstance.length > 0) {
                arr.push({
                    "@type": "Process",
                    "idLocal": obj.Id,
                    "name": obj.Nimi,
                    "descriptionGeneral": obj.TyoOhje,
                    "operator": forOperator(obj.Vastuut),
                    "processInstance": processInstance
                })
            }

        })
    });
    var result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: arr,
        },
    }
    return result;
}

/**
 * Sends forProcessInstance  .
 *
 * @param {Array} data
 * @return {Array}
 */
function forProcessInstance(name, data, config) {
    let arr = [];
    data.forEach(obj => {
        if (obj.Tyonsuoritusaika === null) {
            arr.push({
                "@type": "Process",
                "idLocal": obj.Id,
                "name": name,
                "scheduledStart": obj.Alkaa,
                "scheduledEnd": obj.Loppuu
            })
        }
    })
    let arr2 = formDataOnDate(config, arr)
    return arr2;
}

/**
 * Sends formDataOnDate  .
 *
 * @param {Object} config
 * @return {Array}
 */
function formDataOnDate(config, data) {
    let start = moment(config.parameters.start).format('YYYY-MM-DD');
    let end = moment(config.parameters.end).format('YYYY-MM-DD');
    let arr1 = [];
    data.forEach(function (i) {
        let alkaaDate = moment(i.scheduledStart).format('YYYY-MM-DD');
        let loppuuDate = moment(i.scheduledEnd).format('YYYY-MM-DD');
        if ((moment(alkaaDate).isBetween(start, end, undefined, '[]')) || (moment(loppuuDate).isBetween(start, end, undefined, '[]'))) {
            arr1.push(i)
        }
    })
    return arr1;
}

/**
 * Sends forOperator  .
 *
 * @param {Array} data
 * @return {Array}
 */
function forOperator(data) {
    let arr = [];
    data.forEach(item => {
        item.Vastuullinen.forEach(obj => {
            arr.push({
                "@type": "Organization",
                "idLocal": obj.Id,
                "idOfficial": obj.YritysId,
                "name": obj.Nimi
            })
        })
    })
    return arr;
}


module.exports = {
    name: 'tampuuri-service-request-2',
    parameters,
    output,
    request,
    response
};


