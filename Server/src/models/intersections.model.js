// intersections-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'intersections';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
        coords: { type: Array, required: true },
		_id: { type: Number },
		nature: { type: String, required: true },
	}, {
		timestamps: true
	});

	// This is necessary to avoid model compilation errors in watch mode
	// see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
	if (mongooseClient.modelNames().includes(modelName)) {
		mongooseClient.deleteModel(modelName);
	}
	return mongooseClient.model(modelName, schema);
  
};
