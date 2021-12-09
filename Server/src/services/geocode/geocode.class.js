const { Service } = require('feathers-mongoose');
const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Geocode = class Geocode extends Service {
  
    constructor(options, app) {
        super(options, app)
        this.options = options;
        this.app = app;
    }

    async parse(id) {

        id = id.toLowerCase()
        const addresses = this.app.utils.get('endpoints').find(e => e.name == 'Addresses')
        const communes = (await addresses.model.distinct('commune')).map(c => c.toLowerCase())
        const types_voies = await addresses.model.distinct('type_voie')
        const regexpStr = `(?<numero>\\d+ )?(?<rep>[a-zà-ÿ]+ )?(?<type_voie>${types_voies.map(tv => tv+' ?').join('|')})(?<nom_voie>([a-zà-ÿ]+ ?(?<commune>${communes.map(c => c+' ?').join('|')})?)+)(?<code_postal>\\d{5})?`
        const parts = id.match(new RegExp(regexpStr))?.groups

        if (parts) {
            
            for (const k in parts) {
                if (!parts[k]) delete parts[k]
                else if (typeof parts[k] == 'string') parts[k] = parts[k].trim()
            }
            parts.nom_voie = (parts.type_voie+' '+(parts.commune ? parts.nom_voie.replace(new RegExp(`${parts.commune}$`), '') : parts.nom_voie)).trim()
            parts.numero = Number(parts.numero)
            for (const k in parts) {
                if (!parts[k]) delete parts[k]
            }
    
            return {
                endpoints: [addresses],
                queries: [parts],
            }

        } else {

            const TBM_Stops = this.app.utils.get('endpoints').find(e => e.name == 'TBM_Stops')
            const SNCF_Stops = this.app.utils.get('endpoints').find(e => e.name == 'SNCF_Stops')

            return {
                endpoints: [TBM_Stops, SNCF_Stops],
                queries: [ { libelle_lowercase: { '$regex': id } }, { name_lowercase: { '$regex': id } } ],
            }

        }

    }

    async get(id, params) {

        const { queries, endpoints } = await this.parse(id)
        console.log(parts)

        let result
        try {
            result = await endpoints[0].model.findOne(queries[0]).lean()
            if (result) result.GEOCODE_type = endpoints[0].name
        } catch(_) {}
        
        return result || new NotFound()

    }

    async find(params) {

        const { queries, endpoints } = await this.parse(params.query.id)

        let results = []
        for (let i in endpoints) {
            try {
                let r = await endpoints[i].model.find(queries[i]).lean()
                if (r) {
                    r = r.map(r => {
                        return {
                            ...r,
                            GEOCODE_type: endpoints[i].name
                        }
                    })
                    results.push(...r)
                }
            } catch(_) {}
        }
        
        return results.length ? results : new NotFound()

    }

};
