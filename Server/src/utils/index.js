module.exports = async (app) => {

    const TBM = require('./TBM')(app)

    async function refresh() {
        try {
            console.info(`Refreshing Intersections...`)
            await TBM.refreshIntersections()
            console.info(`Intersections refreshed.`)
            console.info(`Refreshing Sections...`)
            await TBM.refreshSections()
            console.info(`Sections refreshed.`)
            console.info(`Refreshing Stops...`)
            await TBM.refreshStops()
            console.info(`Stops refreshed.`)
            console.info(`Refreshing Lines...`)
            await TBM.refreshLines()
            console.info(`Lines refreshed.`)
        } catch(e) {
            console.error(e)
        }
    }

    // await refresh()
    setInterval(refresh, 24*3600*1000);

}