'use strict';


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
 * @param {Object} data
 * @return {Object}
 */
const response = async (config, data) => {
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
    var arr = [];

    output.data.maintenanceInformation.forEach(function (item) {

        item.product.forEach((data) => {
            arr.push({
                "@type": "Product",
                "ifcGuid": data.value.elementGuid,
                "design" :{
                  "@type": "Design",
                  "status": data.value.elementDesignStatus
                },
                "production": {
                  "@type": "Production",
                  "location": data.value.fabricationPlant,
                  "actualEnd": data.value.fabricationActualEndDate
                },
                "installation": {
                  "@type": "Installation",
                  "plannedEnd": data.value.erectionPlannedEndDate
                }
              })
            
        });
    });
   
    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.data]: arr,
        },
    };

    return result;
}


module.exports = {
    name: 'ncc-product-catalog-parma',
    request,
    output,
    response
};