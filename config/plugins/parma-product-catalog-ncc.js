'use strict';

const ftp = require('../../app/protocols/ftp');

/**
 * Splits period to start and end properties .
 *
 * @param {Object} config
 * @param {Object/String} parameters
 * @return {Object}
 */
const parameters = async (config, parameters) => {
    try {
        parameters.targetObject = Array.isArray(parameters.targetObject) ? parameters.targetObject : [parameters.targetObject]
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
        template.authConfig.secure = template.authConfig.secure === 'true' ? true : false

    } catch (err) {
        return template;
    }
    return template;
};




/**
 * Detect JSON data.
 *
 * @param {String} data
 * @return {Boolean}
 */
const isJSON = (data) => {
    try {
        return !!JSON.parse(data);
    } catch (e) {
        return false;
    }
};


/**
 * Converts CSV to JSON.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, response) => {
    try {
        // console.log("reponse",response)
        if (typeof response.data === 'string' || response.data instanceof String) {
            response = {
                data: {
                    content: response.data,
                },
            };
            // Convert text content to plain data.

            response.data.content = Buffer.from(response.data.content, 'base64').toString('utf-8');
            response.data.encoding = 'utf-8';
            if (isJSON(response.data.content)) {
                response.data.mimetype = 'application/json';
                response.data.content = JSON.parse(response.data.content);
            }

        }
        return response;
    } catch (e) {
        console.log(e.message);
        return response;
    }
};




/**
 * Transforms output to Platform of Trust context schema.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    var arr = [];

    output.data.product.forEach(function (item) {

        item.measurements.forEach((data) => {

            arr.push({
                "@type": "Product",
                "ifcGuid": data.value.content.elementGuid,
                "design": {
                    "@type": "Design",
                    "status": data.value.content.elementDesignStatus
                },
                "production": {
                    "@type": "Production",
                    "location": data.value.content.fabricationPlant,
                    "actualEnd": data.value.content.fabricationActualEndDate
                },
                "installation": {
                    "@type": "Installation",
                    "plannedEnd": data.value.content.erectionPlannedEndDate
                }
            })

        });
    });
    //files contained in output1 folder
    let tmp1 = arr.map(p => p.ifcGuid)

    //files not in output1 folder
    let tmp2 = config.parameters.targetObject.map(p => p.ifcGuid.split(".")[0])

    //new files to include in input1 folder
    var tmp3 = tmp2.filter(e => !tmp1.includes(e));

    if (tmp3.length > 0) {
        tmp3.forEach(async function (item) {
            config.parameters.targetObject = {
                "content": JSON.stringify({
                    "elementGuid": item,
                    "elementDesignStatus": null,
                    "erectionPlannedEndDate": null,
                    "fabricationPlant": null,
                    "fabricationActualEndDate": null
                }),
                "name": `${item}.json`
            }
            await ftp.getData(config, [`${item}.json`], false);
        })
    }

    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: arr,
        },
    };

    return result;
}



module.exports = {
    name: 'parma-product-catalog-ncc',
    output,
    parameters,
    template,
    response,
};