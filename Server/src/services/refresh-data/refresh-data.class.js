/* eslint-disable no-unused-vars */
const { NotFound, BadRequest, Forbidden, GeneralError } = require('@feathersjs/errors');

exports.RefreshData = class RefreshData {

	constructor(options, app) {
        this.options = options;
        this.app = app;
    }

	async find() {
		throw new BadRequest(`This path is disabled.`);
	}

	/**
	 * 
	 * @param {String} id 
	 * @param {Object} params 
	 * @returns 
	 */
	async get(id, params) {

		const endpoints = this.app.utils.get('endpoints')
		const waitForUpdate = JSON.parse(params.query?.waitForUpdate || 'false') === true
		const force = JSON.parse(params.query?.force || 'false') === true
		const matchingEndpoint = endpoints.find(endpoint => endpoint.name === id)
		
		if (id == 'all') {

			return new Promise((res, _) => {
		
				let sucess = 0
				let count = 0
				let lastActualization = 0
				for (const endpoint of endpoints) {
					this.get(endpoint.name, params).then((r) => {
						if (r.Actualized) sucess++, lastActualization = Date.now()
						lastActualization = Date.now()
					}).catch((r) => {
						if (r.lastActualization > lastActualization) lastActualization = r.lastActualization
					}).finally(() => {
						if (waitForUpdate) {
							count++
							if (count === endpoints.length) res({ //every update ended
								"Actualized": sucess,
								"lastActualization": lastActualization,
							}); 
						}
					})
				}
				if (!waitForUpdate) res({
					"Actualized": null, //we don't know anything
					"lastActualization": 0,
				}); 

			})
		
		} else if (matchingEndpoint) {
			if (matchingEndpoint.fetching) {
				if (waitForUpdate) await matchingEndpoint.fetchPromise
				throw new Forbidden({
					"Actualized": false,
					"lastActualization": matchingEndpoint.lastFetch,
					"Reason": "Actualization is ongoing.",
				})
			}
			if ((params.query?.force !== "true") && matchingEndpoint.onCooldown) throw new Forbidden({
				"Actualized": false,
				"lastActualization": matchingEndpoint.lastFetch,
				"Reason": "Actualization is on cooldown.",
			})

			if (waitForUpdate) {

				let r = false
				try {
					r = await matchingEndpoint.fetch(force)
					return {
						"Actualized": r,
						"lastActualization": matchingEndpoint.lastFetch,
					}
				} catch(e) {
					throw new GeneralError(e, {
						"Actualized": false,
						"lastActualization": matchingEndpoint.lastFetch,
					})
				}
				
			} else {

				matchingEndpoint.fetch(force)
				return {
					"Actualized": null, //we don't know anything
					"lastActualization": matchingEndpoint.lastFetch,
				}

			}

		} else throw new NotFound(`Unknown path.`)

	}

	async create() {
		throw new BadRequest(`This path is disabled.`);
	}

	async update() {
		throw new BadRequest(`This path is disabled.`);
	}

	async patch() {
		throw new BadRequest(`This path is disabled.`);
	}

	async remove() {
		throw new BadRequest(`This path is disabled.`);
	}
};
