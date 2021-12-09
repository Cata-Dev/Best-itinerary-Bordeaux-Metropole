const { Service } = require('feathers-mongoose');
const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Geocode = class Geocode extends Service {
  
    constructor(options, app) {
        super(options, app)
        this.options = options;
        this.app = app;
    }

    async parse(id) {

        const addresses = this.app.utils.get('endpoints').find(e => e.name == 'Addresses')
        const communes = (await addresses.model.distinct('commune')).map(c => c.toLowerCase())
        const types_voies = await addresses.model.distinct('type_voie')
        id = id.toLowerCase()
        const regexpStr = `(?<numero>\\d+ )?(?<rep>[a-zà-ÿ]+ )?(?<type_voie>${types_voies.map(tv => tv+' ?').join('|')})(?<nom_voie>([a-zà-ÿ]+ ?(?<commune>${communes.map(c => c+' ?').join('|')})?)+)(?<code_postal>\\d{5})?`
        const parts = id.match(new RegExp(regexpStr))?.groups

        if (!parts) return

        for (const k in parts) {
            if (!parts[k]) delete parts[k]
            else if (typeof parts[k] == 'string') parts[k] = parts[k].trim()
        }
        parts.nom_voie = (parts.type_voie+' '+(parts.commune ? parts.nom_voie.replace(new RegExp(`${parts.commune}$`), '') : parts.nom_voie)).trim()
        parts.numero = Number(parts.numero)
        for (const k in parts) {
            if (!parts[k]) delete parts[k]
        }

        return parts

    }

    async get(id, params) {

        const addresses = this.app.utils.get('endpoints').find(e => e.name == 'Addresses')
        const parts = await this.parse(id)
        if (!parts) return new BadRequest('Invalid address.')
        console.log(parts)

        let result
        try {
            result = await addresses.model.findOne(parts)
        } catch(_) {}
        
        return result || new NotFound()

    }

    async find(params) {

        const addresses = this.app.utils.get('endpoints').find(e => e.name == 'Addresses')
        const parts = await this.parse(params.query.id)
        if (!parts) return new BadRequest('Invalid address.')

        let result
        try {
            result = await addresses.model.find(parts)
        } catch(_) {}
        
        return result || new NotFound()

    }

};
