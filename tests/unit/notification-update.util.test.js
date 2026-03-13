import { describe, expect, it } from 'vitest';

const { buildNotificationUpdatePayload } = require('../../src/utils/notification-update.util');

describe('notification-update util', () => {
  it('sets readAt when marking an unread notification as read', () => {
    const now = new Date('2026-03-13T10:00:00.000Z');
    const payload = buildNotificationUpdatePayload({ isRead: false }, { isRead: true }, now);

    expect(payload).toEqual({
      $set: {
        isRead: true,
        readAt: now,
      },
    });
  });

  it('preserves existing readAt when notification is already read', () => {
    const readAt = new Date('2026-03-10T10:00:00.000Z');
    const payload = buildNotificationUpdatePayload(
      { isRead: true, readAt },
      { isRead: true, title: 'Updated' },
      new Date('2026-03-13T10:00:00.000Z'),
    );

    expect(payload).toEqual({
      $set: {
        isRead: true,
        title: 'Updated',
        readAt,
      },
    });
  });

  it('clears readAt when marking a notification as unread', () => {
    const payload = buildNotificationUpdatePayload(
      { isRead: true, readAt: new Date('2026-03-10T10:00:00.000Z') },
      { isRead: false },
    );

    expect(payload).toEqual({
      $set: {
        isRead: false,
      },
      $unset: {
        readAt: 1,
      },
    });
  });

  it('passes through non-read updates unchanged', () => {
    const payload = buildNotificationUpdatePayload(
      { isRead: false },
      { title: 'New title', message: 'New message' },
    );

    expect(payload).toEqual({
      $set: {
        title: 'New title',
        message: 'New message',
      },
    });
  });
});
