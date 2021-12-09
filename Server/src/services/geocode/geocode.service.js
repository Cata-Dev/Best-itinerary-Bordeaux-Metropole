// Initializes the `geocode` service on path `/geocode`
const { Geocode } = require('./geocode.class');
const createModel = require('../../models/addresses.model');
const hooks = require('./geocode.hooks');

module.exports = function (app) {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/geocode', new Geocode(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('geocode');

  service.hooks(hooks);
};
