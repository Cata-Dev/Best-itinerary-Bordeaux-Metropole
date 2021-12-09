// addresses-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'addresses';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
		_id: { type: Number },
		coords: { type: Array, required: true },
		numero: { type: Number, required: true },
		rep: { type: String, required: false },
        type_voie: { type: String, required: true },
        nom_voie: { type: String, required: true },
        code_postal: { type: Number, required: true },
        fantoir: { type: String, required: true },
        commune: { type: String, required: true },
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
