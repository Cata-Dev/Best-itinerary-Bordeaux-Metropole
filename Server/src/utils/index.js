module.exports = async (app) => {

    app.utils = new Map()

    const TBM = require('./TBM')(app)
    app.utils.set('TBM', TBM)
    const SNCF = require('./SNCF')(app)
    app.utils.set('SNCF', SNCF)
    const endpoints = TBM.endpoints.concat(SNCF.endpoints)
    app.utils.set('endpoints', endpoints)

    async function refresh() {
        for (const endpoint of endpoints.filter((endpoint) => endpoint.rate >= 24*3600)) {
            endpoint.fetching = true
            try {
                endpoint.fetch()
            } catch(e) {
                console.error(e)
            }
            endpoint.fetching = false
        }
    }

    await refresh()
    setInterval(refresh, Math.max(...endpoints.map(endpoint => endpoint.rate)) * 1000);

}