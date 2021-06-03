'use strict';
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
        // Check for necessary information.
        if (!config.authConfig.authPath || !config.authConfig.url) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }
        var username = config.authConfig.username;
        var password = config.authConfig.password;
        //creating authorization
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
    return data.body;
}


/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
 const output = async (config, output) => {
    var base64file = (output.data.sensors[0].data[0].value.toString('base64'));

    //To calculate file size from base64 string in bytes
    function fileSize(file){
        if (file){
            var count;
            var strLen = file.length;
            var stringsearch = "="
            for(var i=count=0; i<file.length; count+=+(stringsearch===file[i++]));
            return String((3*strLen/4)-count);
        }
    }

    output.data['document'] = [{
        "@type": "Document",
        "name": "Luotettava Kumppani PDF Report",
        "nameExtension":".pdf",
        "content":output.data.sensors[0].data[0].value.toString('base64'),
        "categorizationInternetMediaType": "application/pdf",
        "categorizationEncoding": "base64",
        "sizeByte": fileSize(base64file)
    }]
    delete output.data.sensors;
    return output;
}

module.exports = {
    name: 'luotettava-kumppani-report-pdf',
    request,
    output,
    response,
};
