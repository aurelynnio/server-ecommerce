class BaseRepository {
  constructor(Model) {
    this.Model = Model;
  }

  build(payload) {
    return new this.Model(payload);
  }

  // Semantic repository API
  create(payload, options) {
    return this.Model.create(payload, options);
  }

  insertMany(docs, options) {
    return this.Model.insertMany(docs, options);
  }

  findManyByFilter(filter = {}, projection = null, options = {}) {
    return this.Model.find(filter, projection, options);
  }

  findOneByFilter(filter = {}, projection = null, options = {}) {
    return this.Model.findOne(filter, projection, options);
  }

  findById(id, projection = null, options = {}) {
    return this.Model.findById(id, projection, options);
  }

  updateOneByFilter(filter, update, options = {}) {
    return this.Model.updateOne(filter, update, options);
  }

  updateManyByFilter(filter, update, options = {}) {
    return this.Model.updateMany(filter, update, options);
  }

  updateById(id, update, options = {}) {
    return this.Model.findByIdAndUpdate(id, update, options);
  }

  findOneAndUpdateByFilter(filter, update, options = {}) {
    return this.Model.findOneAndUpdate(filter, update, options);
  }

  deleteOneByFilter(filter, options = {}) {
    return this.Model.deleteOne(filter, options);
  }

  deleteManyByFilter(filter, options = {}) {
    return this.Model.deleteMany(filter, options);
  }

  deleteById(id, options = {}) {
    return this.Model.findByIdAndDelete(id, options);
  }

  findOneAndDeleteByFilter(filter, options = {}) {
    return this.Model.findOneAndDelete(filter, options);
  }

  countByFilter(filter = {}) {
    return this.Model.countDocuments(filter);
  }

  existsByFilter(filter = {}) {
    return this.Model.exists(filter);
  }

  aggregateByPipeline(pipeline = [], options = {}) {
    return this.Model.aggregate(pipeline, options);
  }

  distinctByField(field, filter = {}, options = {}) {
    return this.Model.distinct(field, filter, options);
  }

  // Backward-compatible aliases
  find(filter = {}, projection = null, options = {}) {
    return this.findManyByFilter(filter, projection, options);
  }

  findOne(filter = {}, projection = null, options = {}) {
    return this.findOneByFilter(filter, projection, options);
  }

  findOneAndUpdate(filter, update, options = {}) {
    return this.findOneAndUpdateByFilter(filter, update, options);
  }

  findByIdAndUpdate(id, update, options = {}) {
    return this.updateById(id, update, options);
  }

  findOneAndDelete(filter, options = {}) {
    return this.findOneAndDeleteByFilter(filter, options);
  }

  findByIdAndDelete(id, options = {}) {
    return this.deleteById(id, options);
  }

  updateOne(filter, update, options = {}) {
    return this.updateOneByFilter(filter, update, options);
  }

  updateMany(filter, update, options = {}) {
    return this.updateManyByFilter(filter, update, options);
  }

  deleteOne(filter, options = {}) {
    return this.deleteOneByFilter(filter, options);
  }

  deleteMany(filter, options = {}) {
    return this.deleteManyByFilter(filter, options);
  }

  countDocuments(filter = {}) {
    return this.countByFilter(filter);
  }

  exists(filter = {}) {
    return this.existsByFilter(filter);
  }

  aggregate(pipeline = [], options = {}) {
    return this.aggregateByPipeline(pipeline, options);
  }

  distinct(field, filter = {}, options = {}) {
    return this.distinctByField(field, filter, options);
  }
}

module.exports = BaseRepository;
