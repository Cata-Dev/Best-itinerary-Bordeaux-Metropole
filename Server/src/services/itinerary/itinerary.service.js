// Initializes the `itinerary` service on path `/itinerary`
const { Itinerary } = require('./itinerary.class');
const hooks = require('./itinerary.hooks');

module.exports = function (app) {
	const options = {
		paginate: app.get('paginate')
	};

	// Initialize our service with any options it requires
	app.use('/itinerary', new Itinerary(options, app));

	// Get our initialized service so that we can register hooks
	const service = app.service('itinerary');

	service.hooks(hooks);
};
