// sections-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'sections';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
        distance: { type: Number, required: true },
		gid: { type: Number, required: true, unique: true },
		domanial: { type: Number, required: true },
		groupe: { type: Number, required: true },
        nom_voie: { type: String, required: true },
        rg_fv_graph_nd_id: { type: Number, required: true },
        rg_fv_graph_na_id: { type: Number, required: true },
	}, {
		timestamps: true,
		toObject: { virtuals: true },
	});

	schema.virtual('rg_fv_graph_nd', {
		ref: 'nodes',
		localField: 'rg_fv_graph_nd_id',
		foreignField: 'gid'
	});
	schema.virtual('rg_fv_graph_na', {
		ref: 'nodes',
		localField: 'rg_fv_graph_na_id',
		foreignField: 'gid'
	});

	// This is necessary to avoid model compilation errors in watch mode
	// see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
	if (mongooseClient.modelNames().includes(modelName)) {
		mongooseClient.deleteModel(modelName);
	}
	return mongooseClient.model(modelName, schema);
  
};
