/**
 * notification.store.ts – Zustand store for in-app notification center
 * Dependencies: zustand
 */
import { create } from 'zustand';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  timestamp: number;
}

interface NotificationState {
  notifications: Notification[];
  unread: number;
  addNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  markAllRead: () => void;
  clear: () => void;
}

let counter = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unread: 0,
  addNotification: (message, type) =>
    set((s) => ({
      notifications: [
        { id: String(++counter), message, type, timestamp: Date.now() },
        ...s.notifications,
      ].slice(0, 50),
      unread: s.unread + 1,
    })),
  markAllRead: () => set({ unread: 0 }),
  clear: () => set({ notifications: [], unread: 0 }),
}));
