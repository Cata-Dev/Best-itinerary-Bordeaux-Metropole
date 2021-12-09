const { disallow } = require('feathers-hooks-common');

module.exports = {
	before: {
		all: [ disallow('external') ],
		get: [],
	},

	after: {
		all: [],
		get: [],
	},

	error: {
		all: [],
		get: [],
	}
};
