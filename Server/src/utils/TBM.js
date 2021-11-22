const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const bURL = 'https://data.bordeaux-metropole.fr/'

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

	var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
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

	return {

		refreshIntersections: async () => {
			const url = `geojson?key=${app.get('TBMkey')}&typename=fv_carre_p`
			const res = await fetch(`${bURL}${url}`)
			let intersections = (await res.json()).features
			intersections = intersections.map(intersection => {
				return new Intersection({
					geo_point: intersection.geometry.coordinates,
					gid: Number(intersection.properties.gid),
					nature: intersection.properties.nature,
				})
			})
			await Intersection.deleteMany({})
			await Intersection.bulkSave(intersections)
		},

		refreshSections: async () => {
			const url = `geojson?key=${app.get('TBMkey')}&typename=fv_tronc_l`
			const res = await fetch(`${bURL}${url}`)
			let sections = (await res.json()).features
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
		},

		refreshStops: async () => {
			const url = `geojson?key=${app.get('TBMkey')}&typename=sv_arret_p`
			const res = await fetch(`${bURL}${url}`)
			let stops = (await res.json()).features
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
		},

		refreshLines: async () => {
			const url = `geojson?key=${app.get('TBMkey')}&typename=sv_ligne_a`
			const res = await fetch(`${bURL}${url}`)
			let lines = (await res.json()).features
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
		},

		Section,
		Intersection,

	}
}