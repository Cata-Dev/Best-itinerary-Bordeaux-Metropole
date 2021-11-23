const itinerary = require('./itinerary/itinerary.service.js');
const refreshData = require('./refresh-data/refresh-data.service.js');
// eslint-disable-next-line no-unused-vars
module.exports = function (app) {
    app.configure(itinerary);
    app.configure(refreshData);
};
