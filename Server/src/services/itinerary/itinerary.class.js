const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Itinerary = class Itinerary {

    constructor(options, app) {
        this.options = options;
        this.app = app;
    }

    async get(id, params) {

        switch(id) {

            case 'paths':

                if (!(params.query?.from && params.query?.to)) return new BadRequest(`Missing parameter(s).`)

                const endpoints = this.app.utils.get('endpoints')
                //ask for possible non-daily data actualization
                for (const endpoint of endpoints.filter((endpoint) => endpoint.rate < 24*3600)) {
                    try {
                        params.query?.waitForUpdate === 'true' ? await this.app.service('refresh-data').get(endpoint.name, { query: params.query }) : this.app.service('refresh-data').get(endpoint.name, { query: params.query })
                    } catch(_) {}
                }
                return 'Should calculate rust best itineraries, but OK.'

            default:
                return new NotFound('Unknown command.')

        }

    }

};
