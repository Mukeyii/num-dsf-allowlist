/**
 * notification.store.test.ts — pure tests for the in-app notification center:
 * newest-first ordering, unread counting, the 50-item cap, mark-read and clear.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from '../notification.store';

describe('useNotificationStore', () => {
  beforeEach(() => useNotificationStore.getState().clear());

  it('adds a notification newest-first and counts it as unread', () => {
    const s = useNotificationStore.getState();
    s.addNotification('first', 'info');
    s.addNotification('second', 'success');
    const state = useNotificationStore.getState();
    expect(state.notifications[0].message).toBe('second');
    expect(state.notifications).toHaveLength(2);
    expect(state.unread).toBe(2);
  });

  it('caps the list at 50 entries', () => {
    const s = useNotificationStore.getState();
    for (let i = 0; i < 60; i++) s.addNotification(`n${i}`, 'info');
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });

  it('markAllRead zeroes unread but keeps the notifications', () => {
    const s = useNotificationStore.getState();
    s.addNotification('x', 'error');
    s.markAllRead();
    const state = useNotificationStore.getState();
    expect(state.unread).toBe(0);
    expect(state.notifications).toHaveLength(1);
  });

  it('clear empties both the list and the unread count', () => {
    const s = useNotificationStore.getState();
    s.addNotification('x', 'info');
    s.clear();
    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(0);
    expect(state.unread).toBe(0);
  });
});
