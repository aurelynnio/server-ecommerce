const { Message } = require("../models/conversation.model");
const BaseRepository = require("./base.repository");

class MessageRepository extends BaseRepository {
  constructor() {
    super(Message);
  }
}

module.exports = new MessageRepository();
