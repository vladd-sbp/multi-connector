*** Settings ***
Documentation     kerava-indoor - REST
Library           Collections
Library           DateTime
Library           PoTLib
Library           REST         ${CONNECTOR_URL}

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
&{ID1}                       idOfLocation=5d779cb9541b0613acf44c25  idOfSensor=5cee81ac541b0667cc783518
&{ID2}                       idOfLocation=5d779cb9541b0613acf44c25  idOfSensor=5cee8196541b0667cc7834a5
&{ID3}                       idOfLocation=5d779cb9541b0613acf44c25  idOfSensor=5cee81f6541b0667cc783691
${STARTTIME}               	 2021-03-04T10:00:00.001+02:00
${ENDTIME}                 	 2021-03-04T10:35:00.001+02:00
@{IDS}                       ${ID1}  ${ID2}  ${ID3}
${DATA_TYPE_1}               MeasureAirTemperatureCelsiusDegree
${DATA_TYPE_2}               MeasureAirHumidityPercent

@{DATA_TYPES_LIST}           ${DATA_TYPE_1}   ${DATA_TYPE_2}
#...                          ${DATA_TYPE_2}

#@{DATA_TYPES}                &{DATA_TYPES_LIST}
&{BROKER_BODY_PARAMETERS}    ids=@{IDS}
...                          dataTypes=@{DATA_TYPES_LIST}
...                          startTime=${STARTTIME}
...                          endTime=${ENDTIME}
&{BROKER_BODY}               productCode=${PRODUCT_CODE}
...                          parameters=${BROKER_BODY_PARAMETERS}

*** Keywords ***
Fetch Data Product
    [Arguments]     ${body}
    ${signature}    Calculate PoT Signature          ${body}    ${CLIENT_SECRET}
    Set Headers     {"x-pot-signature": "${signature}", "x-app-token": "${APP_TOKEN}"}
    POST            ${CONNECTOR_PATH}                      ${body}
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
    String                response body @context                                  https://standards.oftrust.net/v2/Context/DataProductOutput/Sensor/
    Object                response body data
    Array                 response body data sensors
    Object                response body data sensors 0 id
    Array                 response body data sensors 0 measurements
    String                response body data sensors 0 measurements 0 @type