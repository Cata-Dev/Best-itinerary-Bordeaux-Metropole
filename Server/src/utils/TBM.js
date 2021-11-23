const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

/**
 * Get the distance between two coordinates.
 * @param {Number} lon1 
 * @param {Number} lat1 
 * @param {Number} lon2 
 * @param {Number} lat2 
 * @returns {Number} The distance between (lon1, lat1) and (lon2, lat2) in meters.
 */
function distance(lon1, lat1, lon2, lat2) {
	var earthRadiusKm = 6371;

	var dLat = degreesToRadians(lat2-lat1);
	var dLon = degreesToRadians(lon2-lon1);

	lat1 = degreesToRadians(lat1);
	lat2 = degreesToRadians(lat2);

	var a = Math.sin(dLat/2) ** 2 + Math.sin(dLon/2) ** 2 * Math.cos(lat1) * Math.cos(lat2); 
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	return earthRadiusKm * c * 1000;
}

module.exports = (app) => {

	console.info(`Initializing TBM models...`)

	const Intersection = require('../models/intersections.model')(app)
	const Section = require('../models/sections.model')(app)
	const Stop = require('../models/stops.model')(app)
	const Line = require('../models/lines.model')(app)

	console.log(`Models initialized.`)

	/**
	 * Fetch data from TBM API
	 * @param {String} id dataset identifier
	 * @returns {Obejct}
	 */
	async function getData(id) {
		const bURL = 'https://data.bordeaux-metropole.fr/'
		const url = `geojson?key=${app.get('TBMkey')}&typename=${id}`
		const res = await fetch(`${bURL}${url}`)
		return (await res.json()).features
	}

	return {

		Intersections: async () => {
			console.info(`Refreshing Intersections...`)
			let intersections = await getData('fv_carre_p')
			intersections = intersections.map(intersection => {
				return new Intersection({
					geo_point: intersection.geometry.coordinates,
					gid: Number(intersection.properties.gid),
					nature: intersection.properties.nature,
				})
			})
			await Intersection.deleteMany({})
			await Intersection.bulkSave(intersections)
			console.info(`Intersections refreshed.`)
			return true
		},

		Sections: async () => {
			console.info(`Refreshing Sections...`)
			let sections = await getData('fv_tronc_l')
			sections = sections.map(section => {
				return new Section({
					distance: section.geometry.coordinates.reduce((acc, v, i, arr) => {
						if (i < arr.length - 1) return acc+distance(...v, ...arr[i+1])
						return acc
					}, 0),
					gid: Number(section.properties.gid),
					domanial: Number(section.properties.domanial),
					groupe: section.properties.groupe || 0,
					nom_voie: section.properties.nom_voie,
					rg_fv_graph_nd_id: section.properties.rg_fv_graph_nd,
					rg_fv_graph_na_id: section.properties.rg_fv_graph_na,
				})
			})
			await Section.deleteMany({})
			await Section.bulkSave(sections)
			console.info(`Sections refreshed.`)
			return true
		},

		Stops: async () => {
			console.info(`Refreshing Stops...`)
			let stops = await getData('sv_arret_p')
			stops = stops.map(stop => {
				return new Stop({
					geo_point: stop.geometry?.coordinates || [NaN, NaN], //out of BM
					gid: Number(stop.properties.gid),
					libelle: stop.properties.libelle,
					vehicule: stop.properties.vehicule,
					type: stop.properties.type,
					actif: stop.properties.actif,
				})
			})
			await Stop.deleteMany({})
			await Stop.bulkSave(stops)
			console.info(`Stops refreshed.`)
			return true
		},

		Lines: async () => {
			console.info(`Refreshing Lines...`)
			let lines = await getData('sv_ligne_a')
			lines = lines.map(line => {
				return new Line({
					gid: Number(line.properties.gid),
					libelle: line.properties.libelle,
					vehicule: line.properties.vehicule,
					active: line.properties.active,
				})
			})
			await Line.deleteMany({})
			await Line.bulkSave(lines)
			console.info(`Lines refreshed.`)
			return true
		},

		endpoints: { //every API endpoints we can update + their actualization rate (in seconds)
			Intersections: 24*3600,
			Sections: 24*3600,
			Stops: 24*3600,
			Lines: 24*3600,
			Schedules: 10,
			Vehicles: 10*60,
			Lines_routes: 3600,
		}
	}
}