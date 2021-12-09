const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { bulkOps } = require('./utils')

/**
 * Parse SNCF API date
 * @param {String} string 
 * @returns {Date}
 */
function parseSNCFdate(string) {
	let date = new Date()
	date.setFullYear(Number(string.substr(0, 4)), Number(string.substr(4, 2))-1, Number(string.substr(6, 2)))
	date.setHours(Number(string.substr(9, 2)), Number(string.substr(11, 2)))
	return date
}

/**
 * Format SNCF API date
 * @param {Date} date 
 * @returns {String}
 */
function formatSNCFdate(date) {
	return `${date.getFullYear()}${date.getMonth()+1}${date.getDate()}T${date.getHours()}${date.getMinutes()}00`
}

/**
 * Checks unicity of a value in an array
 * @param {*} v 
 * @param {Number} i 
 * @param {Array} arr 
 * @returns {Boolean}
 */
function unique(v, i, arr) {
	return arr.indexOf(v) === i
}

module.exports = (app) => {

	console.info(`Initializing SNCF models...`)

	const Schedule = require('../models/SNCF_schedules')(app)
	const Stop = require('../models/SNCF_stops')(app)

	console.log(`Models initialized.`)

	/**
	 * Fetch data from SNCF API
	 * @param {Array} paths array or queries to apply
	 * @param {Array} feature array or queries to apply
	 * @param {Array} queries array of queries to apply
	 * @returns {Obejct}
	 */
	async function getData(paths, feature, queries = {}) {
		const bURL = 'https://api.sncf.com/v1'
		const url = `/${Object.keys(paths).map(k => `${k}/${paths[k]}`).join('/')}/${feature}?key=${app.get('SNCFkey')}&${Object.keys(queries).map(k => `${k}=${queries[k]}`).join('&')}`
		const res = await fetch(`${bURL}${url}`)
		return await res.json()
	}

	return {

		endpoints: [
			{
				name: "SNCF_Schedules", rate: 20, fetching: false, //5000req/day
				fetch: async () => {

					console.info(`Refreshing SNCF_Schedules...`)

					let date = formatSNCFdate(new Date())
					/** @type {Array} */
					let route_schedules = (await getData({
						coverage: 'sncf',
						coord: '-0.61439;44.82321', //middle of BM
					},
					'route_schedules',
					{
						distance: 15000, //15km
						count: 500,
						depth: 0,
						data_freshness: 'realtime',
						since: date
					})).route_schedules

					let schedules = []
					for (const route_schedule of route_schedules) {
						for (const i in route_schedule['table']['rows']) { //iterate through rows of schedules table
							const row = route_schedule['table']['rows'][i]
							const stop_point = Number(row['stop_point']['id'].substr(16, 8))
							for (let j in row['date_times']) { //now iterate through columns
								const schedule = row['date_times'][j]
								if (!schedule['data_freshness']) continue //empty cell in schedules table
								const header = route_schedule['table']['headers'][j] //header of the actual column
								const route = `${route_schedule['display_informations']['name']}:${header['display_informations']['direction']}`
								const trip = header['display_informations']['trip_short_name']
								schedules.push({
									_id: `${trip}:${stop_point}`, //equals to 'j:i', 'column:row'
									realtime: parseSNCFdate(schedule['date_time']),
									trip,
									stop_point,
									route,
								})
							}
						}
					}

					await Schedule.deleteMany({ _id: { "$nin": schedules.map(s => s._id) } })
					await Schedule.bulkWrite(bulkOps(schedules))

					console.info(`SNCF_Schedules refreshed.`)

					return true

				},
				model: Schedule,
			},
			{
				name: "SNCF_Stops", rate: 24*3600, fetching: false,
				fetch: async () => {

					console.info(`Refreshing SNCF_Stops...`)

					/** @type {Array} */
					let stops = (await getData({
						coverage: 'sncf',
						coord: '-0.61439;44.82321', //middle of BM
					},
					'stop_points',
					{
						distance: 15000, //15km
						count: 500,
						depth: 0,
					})).stop_points

					stops = stops.map(stop => {
						return {
							_id: Number(stop['id'].substr(16, 8)),
							coords: [Number(stop['coord']['lon']), Number(stop['coord']['lat'])],
							name: stop['name'],
							name_lowercase: stop['name'].toLowerCase(),
						}
					}).filter(unique)

					await Stop.deleteMany({ _id: { "$nin": stops.map(s => s._id) } })
					await Stop.bulkWrite(bulkOps(stops))

					console.info(`SNCF_Stops refreshed.`)
					
					return true

				},
				model: Stop,
			},
		]

	}
}