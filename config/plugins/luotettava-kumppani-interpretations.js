'use strict';
const rp = require('request-promise');
const converter = require('xml-js');
const cache = require('../../app/cache');

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

        var username = config.authConfig.username;
        var password = config.authConfig.password;
        var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

        options.headers = {
            "Authorization" : auth,
        }
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
const response = async (config, data)=>{
    var options = {ignoreComment: true};
    let jsObject = converter.xml2js(data.body, options);
    return jsObject.elements[0].elements;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {

    const data=output.data.sensors[0].data;
    let response = [];

    data.filter((company)=>{
        return company.value.attributes.registration_number === config.parameters.idOfficial && company.value.attributes.country_code === config.parameters.registrationCountry;
    }).map((companyDetails)=>{
            response.push({
                "@type": "Report",
                "idOfficial": companyDetails.value.attributes.registration_number,
                "name": companyDetails.value.attributes.company_name,
                "registrationCountry": companyDetails.value.attributes.country_code,
                "categorizationTrust": companyDetails.value.attributes.interpretation,
                "idSystemLocal": companyDetails.value.attributes.archive_code,
                "created": companyDetails.value.attributes.created
            })
    });

    output.data["OrganizationTrustCategory"] = response;
    delete output.data.sensors;
    return output;
}


module.exports = {
    name: 'luotettava-kumppani-interpretations',
    request,
    output,
    response,
};