/* eslint-disable no-unused-vars */
const { NotFound, BadRequest, Forbidden } = require('@feathersjs/errors');

exports.RefreshData = class RefreshData {

	constructor(options, app) {
        this.options = options;
        this.app = app;
    }

	async find() {
		return new BadRequest(`This path is disabled.`);
	}

	/**
	 * 
	 * @param {String} id 
	 * @param {Object} params 
	 * @returns 
	 */
	async get(id, params) {

		const endpoints = this.app.utils.get('endpoints')
		const waitForUpdate = params.query?.waitForUpdate ? JSON.parse(params.query?.waitForUpdate) === true : false
		const matchingEndpoint = endpoints.find(endpoint => endpoint.name === id)
		
		if (id == 'all') {

			return new Promise((res, _) => {
		
				let sucess = 0
				let count = 0
				for (const endpoint of endpoints) {
					this.get(endpoint.name, params).then(r => {
						if (r.Actualized) sucess++
					}).finally(() => {
						if (waitForUpdate) {
							count++
							if (count === endpoints.length) res({ //every update ended
								"Actualized": sucess,
							}); 
						}
					})
				}
				if (!waitForUpdate) res({
					"Actualized": null, //we don't know anything
				}); 

			})
		
		} else if (matchingEndpoint) {

			if (matchingEndpoint.fetching) return new Forbidden(new Error({
				"Actualized": false,
				"Reason": "Actualization is ongoing.",
			}))
			if ((params.query?.force !== "true") && (Date.now() - ((await matchingEndpoint.model.findOne())?.createdAt || 0) < matchingEndpoint.rate * 1000)) return new Forbidden(new Error({
				"Actualized": false,
				"Reason": "Actualization is on cooldown.",
			}))

			/**
			 * @type {Function}
			 */
			let r = false
			matchingEndpoint.fetching = true
			try {
				r = waitForUpdate ? await matchingEndpoint.fetch() : matchingEndpoint.fetch().finally(() => {
					matchingEndpoint.fetching = false
				})
			} catch(e) {console.error(e)}
			if (waitForUpdate) matchingEndpoint.fetching = false

			return {
				"Actualized": waitForUpdate ? r : null
			}

		} else return new NotFound(`Unknown path.`)

	}

	async create() {
		return new BadRequest(`This path is disabled.`);
	}

	async update() {
		return new BadRequest(`This path is disabled.`);
	}

	async patch() {
		return new BadRequest(`This path is disabled.`);
	}

	async remove() {
		return new BadRequest(`This path is disabled.`);
	}
};
