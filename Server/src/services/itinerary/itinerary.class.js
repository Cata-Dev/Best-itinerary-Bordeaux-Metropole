const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Itinerary = class Itinerary {

    constructor(options, app) {
        this.options = options;
        this.app = app;
    }

    async get(id, params) {

        switch(id) {

            case 'paths':

                if (!(params.query.from && params.query.to)) return new BadRequest(`Missing parameter(s).`)

                const TBM = this.app.utils.get('TBM')
                //ask for possible non-daily data actualization
                for (const endpoint of TBM.endpoints.filter((endpoint) => endpoint.rate < 24*3600)) {
                    try {
                        this.app.service('refresh-data').get(endpoint.name) //await for update ?
                    } catch(_) {}
                }
                //call rust path calc
                return 'ok'

            default:
                return new NotFound('Unknown command.')

        }

    }

};
