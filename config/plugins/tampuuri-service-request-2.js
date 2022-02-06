'use strict';

const moment = require('moment');
const rp = require('request-promise');

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
    output.data.serviceRequest.forEach(function (item) {
        arr.push({
            "@type": "Case",
            "idLocal": item.measurements[0].value.KohdeId,
            "Tehtavat": formDataOnDate(config, item.measurements[0].value.Tehtavat)
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
 * Sends formDataOnDate  .
 *
 * @param {Object} config
 * @return {Array}
 */
function formDataOnDate(config, data) {
    let start = moment(config.parameters.start).format('YYYY-MM-DD');
    let end = moment(config.parameters.end).format('YYYY-MM-DD');
    let arr1 = [];
    data.forEach(function (item) {
        let arr2 = [];
        item.Toimenpiteet.forEach(function (i) {
            if (i.Tyonsuoritusaika === null) {
                let alkaaDate = moment(i.Alkaa).format('YYYY-MM-DD');
                let loppuuDate = moment(i.Loppuu).format('YYYY-MM-DD');
                if((moment(alkaaDate).isBetween(start, end, undefined, '[]')) || (moment(loppuuDate).isBetween(start, end, undefined, '[]'))) {
                    arr2.push(i)
                }

            }
        })
        if(arr2.length>0){
            arr1.push({ "Id": item.Id, "Toimenpiteet": arr2 })
        }
    })
    return arr1;
}

module.exports = {
    name: 'tampuUri-2',
    output,
    request,
    response
};


