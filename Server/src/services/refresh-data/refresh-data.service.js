// Initializes the `refreshData` service on path `/refresh-data`
const { RefreshData } = require('./refresh-data.class');
const hooks = require('./refresh-data.hooks');

module.exports = function (app) {
	const options = {
		paginate: app.get('paginate')
	};

	// Initialize our service with any options it requires
	app.use('/refresh-data', new RefreshData(options, app));

	// Get our initialized service so that we can register hooks
	const service = app.service('refresh-data');

	service.hooks(hooks);
};
