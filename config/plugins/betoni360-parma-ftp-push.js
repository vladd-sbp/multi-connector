'use strict';


/**
 * Splits period to start and end properties .
 *
 * @param {Object} config
 * @param {Object/String} parameters
 * @return {Object}
 */
 const parameters = async (config, parameters) => {
    try {
       parameters.targetObject.content=JSON.stringify(parameters.targetObject.content)
        return parameters;
    } catch (e) {
        return parameters;
    }
};

/**
 * Pick custom ttl.
 *
 * @param {Object} config
 * @param {Object} template
 * @return {Object}
 */
 const template = async (config, template) => {
    try {
        template.authConfig.secure=template.authConfig.secure === 'true' ? true : false

    } catch (err) {
        return template;
    }
    return template;
};


// /**
//  * Response data Mapping
//  *
//  * @param {Object} config
//  * @param {Object} data
//  * @return {Object}
//  */
//  const data = async (config, data) => {
//      //console.log(data)
//         return data;
// };


// /**
//  * Detect JSON data.
//  *
//  * @param {String} data
//  * @return {Boolean}
//  */
//  const isJSON = (data) => {
//     try {
//         return !!JSON.parse(data);
//     } catch (e) {
//         return false;
//     }
// };


// /**
//  * Converts CSV to JSON.
//  *
//  * @param {Object} config
//  * @param {Object} response
//  * @return {Object}
//  */
//  const response = async (config, response) => {
//     try {
//         if (typeof response.data === 'string' || response.data instanceof String) {
//             response = {
//                 data: {
//                     content: response.data,
//                 },
//             };
//             // Convert text content to plain data.
           
//                 response.data.content = Buffer.from(response.data.content, 'base64').toString('utf-8');
//                 response.data.encoding = 'utf-8';
//                 if (isJSON(response.data.content)) {
//                     response.data.mimetype = 'application/json';
//                     response.data.content = JSON.parse(response.data.content);
//                 }
            
//         }
//         return response;
//     } catch (e) {
//         console.log(e.message);
//         return response;
//     }
// };


module.exports = {
    name: 'Betoni360-parma-ftp-push',
    parameters,
    template
    
    
};