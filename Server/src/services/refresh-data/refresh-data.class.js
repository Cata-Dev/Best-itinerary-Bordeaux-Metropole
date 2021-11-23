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
		
		if (id == 'all') {
		
			let c = 0
			for (const endpoint of Object.keys(TBM.endpoints)) {
				let r = false
				try {
					r = (await this.get(endpoint, params)).Actualized //update every endpoint
				} catch(_) {}
				if (r) c++
			}
			return {
				"Actualized": waitForUpdate ? c : null,
			};
		
		} else if (Object.keys(TBM.endpoints).includes(id)) {

			if ( Date.now() - (await TBM.Models[id.substr(0, id.length-1)].findOne()).createdAt < TBM.endpoints[id] * 1000) return {
				"Actualized": false,
				"Reason": "Actualization is on cooldown.",
			}

			/**
			 * @type {Function}
			 */
			const refreshFunction = TBM[id]
			let r = false
			try {
				r = waitForUpdate ? await refreshFunction() : refreshFunction()
			} catch(_) {}

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
