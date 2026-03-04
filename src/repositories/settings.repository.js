const Settings = require('../models/settings.model');

class SettingsRepository {
  findMain() {
    return Settings.findOne({ key: 'main' });
  }

  createMain(data = {}) {
    return Settings.create({ ...data, key: 'main' });
  }

  upsertMainBySet(updateData) {
    return Settings.findOneAndUpdate(
      { key: 'main' },
      { $set: updateData },
      { new: true, upsert: true },
    );
  }

  deleteMain() {
    return Settings.deleteOne({ key: 'main' });
  }
}

module.exports = new SettingsRepository();
