const assert = require('assert');
const app = require('../../src/app');

describe('\'itinerary\' service', () => {
	it('registered the service', () => {
		const service = app.service('itinerary');

		assert.ok(service, 'Registered the service');
	});
});
