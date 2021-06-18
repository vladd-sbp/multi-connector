'use strict';
const { forEach } = require('lodash');
const rp = require('request-promise');
const converter = require('xml-js');
const cache = require('../../app/cache');


/**
 * Changing protocol based on condition.
 *
 * @param {Object} config
 * @param {Object} template
 * @return {Object}
 */
const template = (config, template) =>{
    let dataObject = cache.getDoc('resources',template.productCode);
    let reqtime = cache.getDoc('resources','requesttime');
    if(dataObject!==undefined && (Date.now()-reqtime)<86400000){
        template.protocol= 'custom';
        return template;
    }
    return template;
}


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
 * @param {Object} data
 * @return {Object}
 */
const response = async (config, data)=>{
    let response = cache.getDoc('resources',config.productCode);
    if(!response) {
        response = [];
    }
    if(response.length===0){
        var options = {ignoreComment: true};
        let dataObject = converter.xml2js(data.body, options);
        dataObject.elements[0].elements.map((companyDetails)=>{
            response.push({
                "@type": "Report",
                "idOfficial": companyDetails.attributes.registration_number,
                "name": companyDetails.attributes.company_name,
                "registrationCountry": companyDetails.attributes.country_code,
                "categorizationTrust": companyDetails.attributes.interpretation,
                "idSystemLocal": companyDetails.attributes.archive_code,
                "created": companyDetails.attributes.created
            })
    });
        cache.setDoc('resources',config.productCode,response);
        cache.setDoc('resources','requesttime',Date.now());
    }

    let arr = [];
    let itemdata = {};  
    arr=response.filter((company)=>{
        if ('idOfficial' in config.parameters ) {
            return company.idOfficial === config.parameters.idOfficial && company.registrationCountry === config.parameters.registrationCountry;
        }
    });
    
    itemdata["OrganizationTrustCategory"] = (arr.length) === 0 ? response : arr;
    return itemdata;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    output.data["OrganizationTrustCategory"] = output.data.sensors[0].data[0].value.OrganizationTrustCategory;
    delete output.data.sensors;
    return output;
}


module.exports = {
    name: 'luotettava-kumppani-interpretations',
    request,
    output,
    response,
    template,
};