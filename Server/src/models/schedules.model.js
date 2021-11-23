// schedules-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
module.exports = function (app) {
	const modelName = 'schedules';
	const mongooseClient = app.get('mongooseClient');
	const { Schema } = mongooseClient;
	const schema = new Schema({
		gid: { type: Number, required: true, unique: true },
		hor_theo: { type: Date, required: true },
		hor_app: { type: Date, required: true },
		hor_estime: { type: Date, required: true },
		etat: { type: String, required: true },
		type: { type: String, required: true }, //donnée incertaine
		rs_sv_arret_p_id: { type: Number, required: true },
		rs_sv_cours_a_id: { type: Number, required: true },
	}, {
		timestamps: true,
		toObject: { virtuals: true },
	});

	schema.virtual('rs_sv_arret_p', {
		ref: 'stops',
		localField: 'rs_sv_arret_p_id',
		foreignField: 'gid'
	});
	schema.virtual('rs_sv_cours_a', {
		ref: 'vehicles',
		localField: 'rs_sv_cours_a_id',
		foreignField: 'gid'
	});

	// This is necessary to avoid model compilation errors in watch mode
	// see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
	if (mongooseClient.modelNames().includes(modelName)) {
		mongooseClient.deleteModel(modelName);
	}
	return mongooseClient.model(modelName, schema);
  
};
