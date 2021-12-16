const { NotFound, BadRequest } = require('@feathersjs/errors');

exports.Itinerary = class Itinerary {

    constructor(options, app) {
        this.options = options;
        this.app = app;
    }

    async get(id, params) {

        switch(id) {

            case 'paths':
                const app  = this.app
                const waitForUpdate = params.query?.waitForUpdate
                return new Promise(async (res, _) => {

                    if (!(params.query?.from && params.query?.to)) return new BadRequest(`Missing parameter(s).`)

                    const endpoints = app.utils.get('endpoints').filter((endpoint) => endpoint.rate < 24*3600)
                    let count = 0
                    //ask for possible non-daily data actualization
                    for (const endpoint of endpoints) {
                        app.service('refresh-data').get(endpoint.name, { query: params.query }).finally(() => {
                            if (waitForUpdate) {
                                count++
                                if (count === endpoints.length) res({ code: 200, message: 'Should calculate rust best itineraries, but OK.'})
                            }
                        })
                    }
                    if (!waitForUpdate) res({ code: 200, message: 'Should calculate rust best itineraries, but OK.'})

                })

            default:
                return new NotFound('Unknown command.')

        }

    }

};
