'use strict';
const { forEach } = require('lodash');
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
     console.log("request" , Date.now());
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
        console.log("request" , Date.now());
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
    console.log("response" , Date.now());
    var options = {ignoreComment: true};
    let jsObject = converter.xml2js(data.body, options);

    let elements = jsObject.elements[0].elements.filter( data => data.attributes.registration_number == config.parameters.idOfficial && data.attributes.country_code ==  config.parameters.registrationCountry)
    console.log("--x->", JSON.stringify(elements));
    let response = [];

    elements.forEach(function(item) {
        console.log("-->" , item);
        response.push({
            "@type": "Report",
            "idOfficial": item.attributes.registration_number,
            "name": item.attributes.company_name,
            "registrationCountry": item.attributes.country_code,
            "categorizationTrust": item.attributes.interpretation,
            "idSystemLocal": item.attributes.archive_code,
            "created": item.attributes.created
        })
    })


    console.log("response" , Date.now());
    return response;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    console.log("--22->", JSON.stringify(output));
    console.log("output" , Date.now());
    //const data=output.data.sensors[0].data;
    /*
    let response = [];

    data.forEach(function(item) {
        console.log("-->" , item);
        response.push({
            "@type": "Report",
            "idOfficial": item.value.attributes.registration_number,
            "name": item.value.attributes.company_name,
            "registrationCountry": item.value.attributes.country_code,
            "categorizationTrust": item.value.attributes.interpretation,
            "idSystemLocal": item.value.attributes.archive_code,
            "created": item.value.attributes.created
        })
    })

    
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
    */
    output.data["OrganizationTrustCategory"] = output.data.sensors[0].data[0].value;
    delete output.data.sensors;
    console.log("output--->" , JSON.stringify(output));
    return output;
}


module.exports = {
    name: 'luotettava-kumppani-interpretations',
    request,
    output,
    response,
};