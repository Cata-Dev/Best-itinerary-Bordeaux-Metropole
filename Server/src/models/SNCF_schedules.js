// sncf_schedules-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'sncf_route_schedules';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
		_id: { type: String },
		base_time: { type: Date, required: true },
		realtime: { type: Date },
		trip: { type: Number, required: true }, //implicitly includes direction
        stop_point: { type: String, required: true, ref: 'sncf_stops' },
        route: { type: String, required: true, ref: 'sncf_routes' },
	}, {
		timestamps: true,
	});

	// This is necessary to avoid model compilation errors in watch mode
	// see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
	if (mongooseClient.modelNames().includes(modelName)) {
		mongooseClient.deleteModel(modelName);
	}
	return mongooseClient.model(modelName, schema);
  
};
