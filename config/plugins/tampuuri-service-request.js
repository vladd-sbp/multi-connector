'use strict';

/**
 * Splits processes.
 *
 * @param {Object} config
 * @param {Object} response
 * @return {Object}
 */
const response = async (config, data) =>{
   
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
    output.data.serviceRequest.forEach(function (item){
      arr.push({
        "@type": "Case",
        "idLocal": item.measurements[0].value.Id,
        "descriptionGeneral": "",
        "status": [],
        "statusCode": [],
        "categorizationLocal": item.measurements[0].value.Vikaluokka,
        "categorizationLocalCode": "",
        "categorizationLocalPriorityCode": "",
        "categorizationLocalPriority": item.measurements[0].value.Kiireellisyys,
        "categorizationLocalPriorityOrder": "",
        "canStart": item.measurements[0].value.SuoritusaikaAikaisintaan,
        "canEnd": item.measurements[0].value.SuoritusaikaViimeistään,
        "created": item.measurements[0].value.IlmoitusTehty,
        "duration": "",
        "costLocation": "",
        "parentObject": {
            "@type": "Object",
            "idLocal": item.measurements[0].value.ParentId
        },
		"location": {
			"@type": "Location",
			"streetAddressLine1": "",
			"idLocal": "",
			"space": {
				"@type": "Space",
				"idLocal": item.measurements[0].value.HuoneistoId,
				"name": item.measurements[0].value.Huoneisto
			},
			"organization": {
				"@type": "Organization",
				"name": item.measurements[0].value.Kiinteistö,
				"idLocal": item.measurements[0].value.KohdeId
			}
		},
		"creator": {
			"@type": "Organization",
			"idLocal": item.measurements[0].value.KirjaajaId,
			"name": item.measurements[0].value.KirjaajaNimi
		},
		"requestor": {
			"@type": "Person",
			"idLocal": item.measurements[0].value.IlmoittajaId,
			"name": item.measurements[0].value.Ilmoittaja,
			"organization": {
				"@type": "Organization",
				"name": item.measurements[0].value.Ilmoittaja2
			},
			"contact": {
				"@type": "ContactInformation",
				"streetAddressLine1": item.measurements[0].value.IlmoittajanKatuosoite,
				"postalCode": item.measurements[0].value.IlmoittajanPostinumero,
				"postalArea": item.measurements[0].value.IlmoittajanPostitoimipaikka,
				"phoneNumber": item.measurements[0].value.IlmoittajanPuhelin,
				"phoneNumber2": item.measurements[0].value.IlmoittajanPuhelin2,
				"addressEmail": item.measurements[0].value.IlmoittajanSähköposti,
				"security": item.measurements[0].value.IlmoittajanTurvakielto
			}
		},
		"requestHandler": {
			"@type": "Organization",
			"idLocal": "",
			"name": ""
		},
		"orderer": {
			"@type": "Organization",
			"idLocal": item.measurements[0].value.TilaajaId,
			"name": item.measurements[0].value.Tilaaja,
			"contact": {
				"@type": "ContactInformation",
				"streetAddressLine1": item.measurements[0].value.TilaajanKatuosoite,
				"postalCode": item.measurements[0].value.TilaajanPostinumero,
				"postalArea": item.measurements[0].value.TilaajanPostitoimipaikka,
				"phoneNumber": item.measurements[0].value.TilaajanPuhelin,
				"phoneNumber2": item.measurements[0].value.TilaajanPuhelin2,
				"addressEmail": item.measurements[0].value.TilaajanSähköposti,
				"security": item.measurements[0].value.TilaajanTurvakielto
			}
		},
		"payer": {
			"@type": "Organization",
			"name": item.measurements[0].value.Maksaja,
			"idLocal": item.measurements[0].value.Maksaja2,
			"contact": {
				"@type": "ContactInformation",
				"streetAddressLine1": item.measurements[0].value.MaksajanKatuosoite,
				"postalCode": item.measurements[0].value.MaksajanPostinumero,
				"postalArea": item.measurements[0].value.MaksajanPostitoimipaikka,
				"phoneNumber": item.measurements[0].value.MaksajanPuhelin,
				"phoneNumber2": item.measurements[0].value.MaksajanPuhelin2,
				"addressEmail": item.measurements[0].value.MaksajanSähköposti,
				"security": item.measurements[0].value.MaksajanTurvakielto
			}
		},
		"process": {
			"@type": "Process",
			"name": item.measurements[0].value.TyötehtävänOtsikko,
			"descriptionGeneral": item.measurements[0].value.TyötehtävänKuvaus,
			"additionalInformation": item.measurements[0].value.TyötehtävänLisätiedot,
			"travelKilometers": item.measurements[0].value.Kilometrit,
			"costEstimation": item.measurements[0].value.Kustannusarvio,
			"refundAmount": item.measurements[0].value.Hyvityssumma,
			"mustDone": item.measurements[0].value.TyöValmisViimeistään,
			"contact": {
				"@type": "ContactInformation",
				"name": item.measurements[0].value.TyotehtavanYhteysHenkilo,
				"phoneNumber": item.measurements[0].value.TyotehtavanYhteysHenkiloPuhelinnumero
			},
			"executor": [
				{
					"@type": "Organization",
					"name": item.measurements[0].value.TyonsuorittajaYritysNimi,
					"idLocal": item.measurements[0].value.TyonsuorittajaYritysId
				},
				{
					"@type": "Person",
					"name": item.measurements[0].value.TyonsuorittajaHenkiloNimi,
					"idLocal": item.measurements[0].value.TyonsuorittajaHenkiloId
				}
			]
		}


      })
    });
   var result ={
    [config.output.context]: config.output.contextValue,
    [config.output.object]: {
        [config.output.array]: arr,
    },
   }
    return result;
}

module.exports = {
    name: 'tampuUri',
   output,
    response,
};


