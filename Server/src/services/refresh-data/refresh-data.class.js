/* eslint-disable no-unused-vars */
const { NotFound, BadRequest } = require('@feathersjs/errors');

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

		const TBM = this.app.utils.get('TBM')
		const waitForUpdate = params.query?.waitForUpdate === 'true'
		const matchingEndpoint = TBM.endpoints.find(endpoint => endpoint.name === id)
		
		if (id == 'all') {
		
			let c = 0
			for (const endpoint of TBM.endpoints) {
				let r = false
				try {
					r = (await this.get(endpoint.name, params)).Actualized //update every endpoint
				} catch(_) {}
				if (r) c++
			}
			return {
				"Actualized": waitForUpdate ? c : null,
			};
		
		} else if (matchingEndpoint) {

			if (matchingEndpoint.fetching) throw new Error({
				"Actualized": false,
				"Reason": "Actualization is ongoing.",
			})
			if ((params.query.force !== "true") && (Date.now() - ((await matchingEndpoint.model.findOne())?.createdAt || 0) < matchingEndpoint.rate * 1000)) throw new Error({
				"Actualized": false,
				"Reason": "Actualization is on cooldown.",
			})

			/**
			 * @type {Function}
			 */
			let r = false
			try {
				r = waitForUpdate ? await matchingEndpoint.fetch() : matchingEndpoint.fetch()
			} catch(e) {console.error(e)}

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
