const { Service } = require('feathers-mongoose');
const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Geocode = class Geocode extends Service {
  
    constructor(options, app) {
        super(options, app)
        this.options = options;
        this.app = app;
    }

    async refreshInternalData() {
        this.addresses = this.app.utils.get('endpoints').find(e => e.name == 'Addresses')
        this.communes = (await this.addresses.model.distinct('commune')).map(c => c.toLowerCase())
        this.types_voies = await this.addresses.model.distinct('type_voie')
        this.reps = (await this.addresses.model.distinct('rep')).filter(r => r)
    }

    /**
     * @param {String} id 
     * @param {Boolean} multi
     */
    async parse(id) {

        const TBM_Stops = this.app.utils.get('endpoints').find(e => e.name == 'TBM_Stops')
        const SNCF_Stops = this.app.utils.get('endpoints').find(e => e.name == 'SNCF_Stops')

        id = id.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
        if (!this.communes) await this.refreshInternalData()
        const regexpStr = `(?<numero>\\d+ )?(?<rep>${this.reps.map(r => r.toLowerCase()+' ').join('|')})?(?<type_voie>${this.types_voies.map(tv => tv.toLowerCase()+' ?').join('|')})?(?<nom_voie_lowercase>([a-zà-ÿ-']+ ?(?<commune>${this.communes.map(c => c+' ?').join('|')})?)+)(?<code_postal>\\d{5})?`
        const parts = id.match(new RegExp(regexpStr))?.groups

        if (parts) {
            
            for (const k in parts) {
                if (!parts[k]) delete parts[k]
                else if (typeof parts[k] == 'string') parts[k] = parts[k].trim()
            }
            if (parts.numero) parts.numero = Number(parts.numero)
            parts.nom_voie_lowercase = ((parts.type_voie || '')+' '+(parts.commune ? parts.nom_voie_lowercase.replace(new RegExp(`${parts.commune}$`), '') : parts.nom_voie_lowercase)).trim()
            if (parts.type_voie) parts.type_voie = this.types_voies.find(v => v.toLowerCase() == parts.type_voie) //get back the uppercase type_voie
            for (const k in parts) {
                if (!parts[k]) delete parts[k]
                else if (typeof parts[k] == 'string') parts[k] = { '$regex': parts[k] }
            }
    
            return {
                endpoints: [this.addresses, TBM_Stops, SNCF_Stops],
                queries: [parts, { libelle_lowercase: { '$regex': id } }, { name_lowercase: { '$regex': id } }],
            }

        } else {

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
        for (let i in endpoints) {
            try {
                result = await endpoints[i].model.findOne(queries[i]).collation({ locale: 'fr', strength: 1 }).lean()
                if (result) {
                    result.GEOCODE_type = endpoints[0].name
                    break
                }
            } catch(_) {}
        }
        
        return result || new NotFound()

    }

    async find(params) {

        const { queries, endpoints } = await this.parse(params.query.id)

        let results = []
        for (let i in endpoints) {
            try {
                let r = await endpoints[i].model.find(queries[i]).collation({ locale: 'fr', strength: 1 }).limit(params.query?.max || 1000).lean()
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
        if (results.length && params.query.max) results = results.slice(0, Number(params.query.max))
        
        return results.length ? results : new NotFound()

    }

};
