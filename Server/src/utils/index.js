module.exports = async (app) => {

    app.utils = new Map()

    const TBM = require('./TBM')(app)
    app.utils.set('TBM', TBM)

    async function refresh() {
        for (const endpoint of TBM.endpoints.filter((endpoint) => endpoint.rate >= 24*3600)) {
            endpoint.fetching = true
            try {
                await endpoint.fetch()
            } catch(e) {
                console.error(e)
            }
            endpoint.fetching = false
        }
    }

    await refresh()
    setInterval(refresh, Math.max(...TBM.endpoints.map(endpoint => endpoint.rate)) * 1000);

}