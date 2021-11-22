// lines_routes-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'lines_routes';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
		gid: { type: Number, required: true, unique: true },
		libelle: { type: String, required: true },
		sens: { type: String, required: true },
		vehicule: { type: String, required: true },
		rs_sv_ligne_a_id: { type: String, required: true },
		rg_sv_arret_p_nd_id: { type: String, required: true },
		rg_sv_arret_p_na_id: { type: String, required: true },
	}, {
		timestamps: true,
		toObject: { virtuals: true },
	});

	schema.virtual('rs_sv_ligne_a', {
		ref: 'lines',
		localField: 'rs_sv_ligne_a_id',
		foreignField: 'gid'
	});
	schema.virtual('rg_sv_arret_p_nd', {
		ref: 'stops',
		localField: 'rg_sv_arret_p_nd_id',
		foreignField: 'gid'
	});
	schema.virtual('rg_sv_arret_p_na', {
		ref: 'stops',
		localField: 'rg_sv_arret_p_na_id',
		foreignField: 'gid'
	});

	// This is necessary to avoid model compilation errors in watch mode
	// see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
	if (mongooseClient.modelNames().includes(modelName)) {
		mongooseClient.deleteModel(modelName);
	}
	return mongooseClient.model(modelName, schema);
  
};
