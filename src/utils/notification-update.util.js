function buildNotificationUpdatePayload(currentNotification, updates, now = new Date()) {
  const nextUpdates = { ...updates };
  const updatePayload = { $set: nextUpdates };

  if (nextUpdates.isRead === true) {
    if (!currentNotification?.isRead && !currentNotification?.readAt) {
      updatePayload.$set.readAt = now;
    } else if (currentNotification?.readAt) {
      updatePayload.$set.readAt = currentNotification.readAt;
    }
  }

  if (nextUpdates.isRead === false) {
    updatePayload.$unset = { readAt: 1 };
  }

  return updatePayload;
}

module.exports = {
  buildNotificationUpdatePayload,
};
