const mongoose = require('mongoose');

module.exports = function (app) {
	mongoose.connect(
		app.get('mongodb'),
		{ useNewUrlParser: true }
	).then(() => {
		console.info('Database connected.')
	}).catch(err => {
		console.error(err);
		process.exit(1);
	});

	app.set('mongooseClient', mongoose);
};
