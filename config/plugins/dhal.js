'use strict';

const edi = require('rdpcrystal-edi-library');
var converter = require('./jsonToEdi')
const sftp = require('../../app/protocols/sftp');

/**
 * Configures SOAP authentication.
 *
 * @param {Object} config
 * @param {Object} options
 * @return {Object}
 */

const request = async (config, options) => {
    console.log("13....................,", options)
    return options;
};

/**
* Manipulates request parameters.
*
* @param {Object} config
* @param {Object} parameters
* @return {Object}
*/
const parameters = async (config, parameters) => {
    try {
        let obj={}
        if(parameters && parameters.targetObject){
            obj.content=converter.jsonToEdi(parameters.targetObject),
            obj.name="dhal.edi",
            delete parameters.targetObject,
            parameters.targetObject=obj
        }
        return parameters;
    } catch (err) {
        return parameters;
    }
};

/**
 * Switch querying protocol to SFTP.
 *
 * @param {Object} config
 * @param {Object} template
 * @return {Object}
 */
const template = async (config, template) => {
    try {
      
        return template;

    }

    catch (err) {
        return Promise.reject(err);
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
    console.log(".....")
    return data;

}

/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    console.log("..output")
    return output;
}

module.exports = {
    name: 'sftp-test-1',
    template,
    request,
    output,
    response,
    parameters
};
