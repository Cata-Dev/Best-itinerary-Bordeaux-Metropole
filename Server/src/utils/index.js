module.exports = async (app) => {

    app.utils = new Map()

    const TBM = require('./TBM')(app)
    app.utils.set('TBM', TBM)

    async function refresh() {
        for (const endpoint of Object.keys(TBM.endpoints).filter((endpoint) => TBM.endpoints[endpoint] < 24*3600)) {
            try {
                await TBM[endpoint]()
            } catch(e) {
                console.error(e)
            }
        }
    }

    await refresh()
    setInterval(refresh, Math.max(...Object.values(TBM.endpoints)) * 1000);

}