const Settings = require('../models/settings.model');
const BaseRepository = require('./base.repository');

class SettingsRepository extends BaseRepository {
  constructor() {
    super(Settings);
  }

  findMain() {
    return this.findOneByFilter({ key: 'main' });
  }

  createMain(data = {}) {
    return this.create({ ...data, key: 'main' });
  }

  upsertMainBySet(updateData) {
    return this.findOneAndUpdateByFilter(
      { key: 'main' },
      { $set: updateData },
      { new: true, upsert: true },
    );
  }

  deleteMain() {
    return this.deleteOneByFilter({ key: 'main' });
  }
}

module.exports = new SettingsRepository();
