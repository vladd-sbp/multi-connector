'use strict';
const rp = require('request-promise');
/**
* Manipulates request parameters.
*
* @param {Object} config
* @param {Object} parameters
* @return {Object}
*/
const parameters = async (config, parameters) => {
    try {
        console.log("config", config);
        console.log("parameters", parameters);
        return parameters;
    } catch (err) {
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

//  const options = {
//     method: 'POST',
//     url: url,
//     headers: {
//         'Content-Type': 'application/json'
//     },
//     body: {

//         username: "",
//         password: "",

//     },
// }

 const request = async (config, options) => {
    try {
        // Check for necessary information.
        if (!config.authConfig.authPath || !config.authConfig.url) {
            return promiseRejectWithError(500, 'Insufficient authentication configurations.');
        }
console.log("options ",options);
console.log("config ", config);

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
// };

// var username = "";
// var password = "";
// var auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
// var request = require('request');
// var url = "http://localhost:5647/contact/session/";

// request.get( {
//     url : url,
//     headers : {
//         "Authorization" : auth
//     }
//   }, function(error, response, body) {
//       console.log('body : ', body);
//   } );

    
module.exports = {
    name: 'vastuu',
    request,
    parameters,
};