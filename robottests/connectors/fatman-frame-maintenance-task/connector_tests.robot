*** Settings ***
Documentation     fatman - REST
Library           Collections
Library           DateTime
Library           PoTLib
Library           REST         ${API_URL}

*** Variables ***
${LOCAL_TZ}                  +02:00
${TEST_ENV}                  sandbox
${API_URL}                   https://api-${TEST_ENV}.oftrust.net
${API_PATH}                  /broker/v1/fetch-data-product
${CONNECTOR_URL}             http://localhost:8080
${CONNECTOR_PATH}            /translator/v1/fetch
${APP_TOKEN}                 %{POT_APP_ACCESS_TOKEN}
${CLIENT_SECRET}             %{POT_CLIENT_SECRET}
${PRODUCT_CODE}              %{POT_PRODUCT_CODE}

${ID1LOCAL}                  22397
${ID1TYPE}                   Building

${ID2LOCAL}                  22397
${ID2TYPE}                   Building

&{TARGET_OBJECT1}
...                          idLocal=${ID1LOCAL}
...                          @type=${ID1TYPE}

&{TARGET_OBJECT2}
...                          idLocal=${ID2LOCAL}
...                          @type=${ID2TYPE}

@{TARGET_OBJECTS}
...                          ${TARGET_OBJECT1}
#...                          ${TARGET_OBJECT2}

${DATA_TYPE_1}               InProgress
${DATA_TYPE_2}               Ready

${PERIOD}               	 2018-06-11T00:00:00+00:00/2019-06-11T00:00:00+00:00

@{DATA_TYPES_LIST}           
#...                          ${DATA_TYPE_1}
#...                          ${DATA_TYPE_2}

&{BROKER_BODY_PARAMETERS}    targetObject=@{TARGET_OBJECTS}
...                          status=@{DATA_TYPES_LIST}              
...                          period=${PERIOD}
&{BROKER_BODY}               productCode=${PRODUCT_CODE}
...                          parameters=${BROKER_BODY_PARAMETERS}

*** Keywords ***
Fetch Data Product
    [Arguments]     ${body}
    ${signature}    Calculate PoT Signature          ${body}    ${CLIENT_SECRET}
    Set Headers     {"x-pot-signature": "${signature}", "x-app-token": "${APP_TOKEN}"}
    POST             ${API_PATH}                        ${body}
    Output schema   response body

Get Body
    [Arguments]          &{kwargs}
    ${body}              Copy Dictionary      ${BROKER_BODY}    deepcopy=True
    ${now}               Get Current Date     time_zone=UTC     result_format=%Y-%m-%dT%H:%M:%S+00:00
    Set To Dictionary    ${body}              timestamp         ${now}
    Set To Dictionary    ${body}              &{kwargs}
    ${json_string}=      evaluate             json.dumps(${body})   json
    [Return]             ${body}

Fetch Data Product With Timestamp
    [Arguments]            ${increment}       ${time_zone}=UTC      ${result_format}=%Y-%m-%dT%H:%M:%S.%fZ
    ${timestamp}           Get Current Date
    ...                    time_zone=${time_zone}
    ...                    result_format=${result_format}
    ...                    increment=${increment}
    ${body}                Get Body                       timestamp=${timestamp}
    Fetch Data Product     ${body}

Fetch Data Product With Timestamp 200
    [Arguments]            ${increment}       ${time_zone}=UTC      ${result_format}=%Y-%m-%dT%H:%M:%S.%fZ
    Fetch Data Product With Timestamp         ${increment}    ${time_zone}    ${result_format}
    Integer                response status                200
    Array                  response body data items       minItems=2

Fetch Data Product With Timestamp 422
    [Arguments]            ${increment}
    Fetch Data Product With Timestamp         ${increment}
    Integer    response status                422
    Integer    response body error status     422
    String     response body error message    Request timestamp not within time frame.

*** Test Cases ***
fetch, 200
    ${body}               Get Body
    Fetch Data Product    ${body}
    Integer               response status                                         200
    String                response body @context                                  https://standards-ontotest.oftrust.net/v2/DataExample/DataProductParameters/MaintenanceInformation
    Object                response body data
    Array                 response body data maintenanceInformation
  
  