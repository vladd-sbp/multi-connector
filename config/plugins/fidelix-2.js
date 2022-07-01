'use strict';
/**
 * Module dependencies.
 */
const _ = require('lodash');


/**
 * Composes request arguments.
 *
 * @param {Object} config
 * @param {Object} template
 * @return {Object}
 */
const template = async (config, template) => {
    return template;
};

/**
 * Parses response data.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, response) => {
    if (!_.isObject(response)) {
        return response;
    }
    let result = [];

    // 1. One value per request (latest).
    const single = 'setPointDataResult';
    try {
        if (Object.hasOwnProperty.call(response, single)) {
            const data = {
                [single]: response['setPointDataResult'],
                hardwareId: response.hardwareId['point_id'],
            };
            result.push(data);
        } else {
            result = response;
        }
        return result;
    } catch (e) {
        return result;
    }
};



/**
 * Filters data by point ids.
 *
 * @param {Object} config
 * @param {Object} output
 * @return {Object}
 */
const output = async (config, output) => {
    var arr = [];
    if(output.data.process.length>0){
        output.data.process.forEach(function (item) {

            item.measurements.forEach((data) => {
                arr.push(
                    {
                        "@type":  config.parameters.targetObject[0]['@type'],
                        "location": {
                            "idLocal": config.authConfig.path.point_id
                        },
                        "processTarget": config.parameters.targetObject[0].processTarget,
                    "processTargetId": config.parameters.targetObject[0].processTargetId,
                    "physicalProperty": config.parameters.targetObject[0].physicalProperty,
                    "status": [
                        {
                            "value": data.result===true ? "Completed" :"Failed" 
                          //  "statusReason": "<error response in string format here>" --> "500 - Internal server error" 
                        }
                    ],
                    "processValue": [
                        {
                            "@type": config.parameters.targetObject[0].processValue[0]['@type'],
                            "processValue":config.parameters.targetObject[0].processValue[0].processValue,
                            "exactTime": data.timestamp,
                            "unitOfMeasure": config.parameters.targetObject[0].processValue[0].unitOfMeasure
                        }
                    ]
                    }
                )
            });
        });
    }else if(output.data.process.length==0){
        arr.push(
            {
                "@type":  config.parameters.targetObject[0]['@type'],
                "location": {
                    "idLocal": config.authConfig.path.point_id
                },
                "processTarget": config.parameters.targetObject[0].processTarget,
            "processTargetId": config.parameters.targetObject[0].processTargetId,
            "physicalProperty": config.parameters.targetObject[0].physicalProperty,
            "status": [
                {
                    "value":"Failed" ,
                    "statusReason": "" 
                }
            ],
            "processValue": [
                {
                    "@type": config.parameters.targetObject[0].processValue[0]['@type'],
                    "processValue":config.parameters.targetObject[0].processValue[0].processValue,
                    "exactTime": config.timestamp,
                    "unitOfMeasure": config.parameters.targetObject[0].processValue[0].unitOfMeasure
                }
            ]
            }
        )
    }
  


    const result = {
        [config.output.context]: config.output.contextValue,
        [config.output.object]: {
            [config.output.array]: arr,
        },
    };

    return result;

};

/**
 * Expose plugin methods.
 */
module.exports = {
    name: 'fidelix-2',
    template,
    response,
    output,
};
