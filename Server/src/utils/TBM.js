const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { bulkOps } = require('./utils')

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

	const Address = require('../models/addresses.model')(app)
	const Intersection = require('../models/intersections.model')(app)
	const Section = require('../models/sections.model')(app)
	const Stop = require('../models/TBM_stops.model')(app)
	const Line = require('../models/TBM_lines.model')(app)
	const Schedule = require('../models/TBM_schedules.model')(app)
	const Vehicle = require('../models/TBM_vehicles.model')(app)
	const Lines_route = require('../models/TBM_lines_routes.model')(app)

	console.log(`Models initialized.`)

	/**
	 * Fetch data from TBM API
	 * @param {String} id dataset identifier
	 * @param {Array} queries array of queries to apply
	 * @returns {Obejct}
	 */
	async function getData(id, queries = []) {
		const bURL = 'https://data.bordeaux-metropole.fr/'
		const url = `geojson?key=${app.get('TBMkey')}&typename=${id}&${queries.join('&')}`
		const res = await fetch(`${bURL}${url}`)
		return (await res.json()).features
	}

	return {

		endpoints: [
			{
				name: "Addresses", rate: 24*3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing Addresses...`)
					let addresses = await getData('fv_adresse_p')
					addresses = addresses.map(address => {
						const voie = address.properties.nom_voie
						return {
							_id: Number(address.properties.gid),
							coords: address.geometry.coordinates,
							numero: address.properties.numero,
							rep: address.properties.rep,
							type_voie: voie.match(/[A-zàÀ-ÿ]+/g)[0],
							nom_voie: voie,
							nom_voie_lowercase: voie.toLowerCase(),
							code_postal: address.properties.cpostal,
							fantoir: address.properties.fantoir,
							commune: address.properties.commune,
						}
					})
					await Address.deleteMany({ _id: { "$nin": addresses.map(i => i._id) } })
					await Address.bulkWrite(bulkOps(addresses))
					console.info(`Addresses refreshed.`)
					return true
				},
				model: Address,
			},
			{
				name: "Intersections", rate: 24*3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing Intersections...`)
					let intersections = await getData('fv_carre_p')
					intersections = intersections.map(intersection => {
						return {
							coords: intersection.geometry.coordinates,
							_id: Number(intersection.properties.gid),
							nature: intersection.properties.nature,
						}
					})
					await Intersection.deleteMany({ _id: { "$nin": intersections.map(i => i._id) } })
					await Intersection.bulkWrite(bulkOps(intersections))
					console.info(`Intersections refreshed.`)
					return true
				},
				model: Intersection,
			},
			{
				name: "Sections", rate: 24*3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing Sections...`)
					let sections = await getData('fv_tronc_l')
					sections = sections.map(section => {
						return {
							distance: section.geometry.coordinates.reduce((acc, v, i, arr) => {
								if (i < arr.length - 1) return acc+distance(...v, ...arr[i+1])
								return acc
							}, 0),
							_id: Number(section.properties.gid),
							domanial: Number(section.properties.domanial),
							groupe: section.properties.groupe || 0,
							nom_voie: section.properties.nom_voie,
							rg_fv_graph_nd: section.properties.rg_fv_graph_nd,
							rg_fv_graph_na: section.properties.rg_fv_graph_na,
						}
					})
					await Section.deleteMany({ _id: { "$nin": sections.map(s => s._id) } })
					await Section.bulkWrite(bulkOps(sections))
					console.info(`Sections refreshed.`)
					return true
				},
				model: Section,
			},
			{
				name: "TBM_Stops", rate: 24*3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing TBM_Stops...`)
					let stops = await getData('sv_arret_p')
					stops = stops.map(stop => {
						return {
							coords: stop.geometry?.coordinates || [NaN, NaN], //out of BM
							_id: Number(stop.properties.gid),
							libelle: stop.properties.libelle,
							libelle_lowercase: stop.properties.libelle.toLowerCase(),
							vehicule: stop.properties.vehicule,
							type: stop.properties.type,
							actif: stop.properties.actif,
						}
					})
					await Stop.deleteMany({ _id: { "$nin": stops.map(s => s._id) } })
					await Stop.bulkWrite(bulkOps(stops))
					console.info(`TBM_Stops refreshed.`)
					return true
				},
				model: Stop,
			},
			{
				name: "TBM_Lines", rate: 24*3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing TBM_Lines...`)
					let lines = await getData('sv_ligne_a')
					lines = lines.map(line => {
						return {
							_id: Number(line.properties.gid),
							libelle: line.properties.libelle,
							vehicule: line.properties.vehicule,
							active: line.properties.active,
						}
					})
					await Line.deleteMany({ _id: { "$nin": lines.map(l => l._id) } })
					await Line.bulkWrite(bulkOps(lines))
					console.info(`TBM_Lines refreshed.`)
					return true
				},
				model: Line,
			},
			{
				name: "TBM_Schedules", rate: 10, fetching: false,
				fetch: async () => {
					console.info(`Refreshing TBM_Schedules...`)
					const date = (new Date()).toJSON().substr(0, 19)
					let schedules = await getData('sv_horai_a', ["filter="+JSON.stringify({
						"$or": [
							{
								"hor_theo": {
									"$gte": date
								}
							}, {
								"hor_app": {
									"$gte": date
								},
							}, {
								"hor_estime": {
									"$gte": date
								},
							}
						]
					})])
					schedules = schedules.map(schedule => {
						return {
							_id: Number(schedule.properties.gid),
							hor_theo: new Date(schedule.properties.hor_theo),
							hor_app: new Date(schedule.properties.hor_app),
							hor_estime: new Date(schedule.properties.hor_estime),
							etat: schedule.properties.etat,
							type: schedule.properties.type,
							rs_sv_arret_p: Number(schedule.properties.rs_sv_arret_p),
							rs_sv_cours_a: Number(schedule.properties.rs_sv_cours_a),
						}
					})
					await Schedule.deleteMany({ _id: { "$nin": schedules.map(s => s._id) } })
					await Schedule.bulkWrite(bulkOps(schedules))
					console.info(`TBM_Schedules refreshed.`)
					return true
				},
				model: Schedule,
			},
			{
				name: "TBM_Vehicles", rate: 10*60, fetching: false,
				fetch: async () => {
					console.info(`Refreshing TBM_Vehicles...`)
					let vehicles = await getData('sv_cours_a', ["filter="+JSON.stringify({
						"etat": {
							"$in": [ "NON_COMMENCE", "EN_COURS" ]
						}
					})])
					vehicles = vehicles.map(vehicle => {
						return {
							_id: Number(vehicle.properties.gid),
							etat: vehicle.properties.etat,
							rg_sv_arret_p_nd: Number(vehicle.properties.rg_sv_arret_p_nd),
							rg_sv_arret_p_na: Number(vehicle.properties.rg_sv_arret_p_na),
							rs_sv_ligne_a: Number(vehicle.properties.rs_sv_ligne_a),
							rs_sv_chem_l: Number(vehicle.properties.rs_sv_chem_l),
						}
					})
					await Vehicle.deleteMany({ _id: { "$nin": vehicles.map(v => v._id) } })
					await Vehicle.bulkWrite(bulkOps(vehicles))
					console.info(`TBM_Vehicles refreshed.`)
					return true
				},
				model: Vehicle,
			},
			{
				name: "TBM_Lines_routes", rate: 3600, fetching: false,
				fetch: async () => {
					console.info(`Refreshing TBM_Lines_routes...`)
					let lines_routes = await getData('sv_chem_l', ["attributes="+JSON.stringify([
						"gid", "libelle", "sens", "vehicule", "rs_sv_ligne_a", "rg_sv_arret_p_nd", "rg_sv_arret_p_na"
					])])
					lines_routes = lines_routes.map(lines_route => {
						return {
							_id: Number(lines_route.properties.gid),
							libelle: lines_route.properties.libelle,
							sens: lines_route.properties.sens,
							vehicule: lines_route.properties.vehicule,
							rs_sv_ligne_a: Number(lines_route.properties.rs_sv_ligne_a),
							rg_sv_arret_p_nd: Number(lines_route.properties.rg_sv_arret_p_nd),
							rg_sv_arret_p_na: Number(lines_route.properties.rg_sv_arret_p_na),
						}
					})
					await Lines_route.deleteMany({ _id: { "$nin": lines_routes.map(l_r => l_r._id) } })
					await Lines_route.bulkWrite(bulkOps(lines_routes))
					console.info(`TBM_Lines_routes refreshed.`)
					return true
				},
				model: Lines_route,
			},
		]

	}
}