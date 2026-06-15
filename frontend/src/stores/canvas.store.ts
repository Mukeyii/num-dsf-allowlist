/**
 * canvas.store.ts – UI state for the Entity Graph Canvas
 */
import { create } from 'zustand';

type EntityId =
  | 'organization'
  | 'contacts'
  | 'endpoints'
  | 'certificates'
  | 'memberships'
  | 'approval';

interface CanvasState {
  activeInstanceId: string | null;
  highlightedEntity: EntityId | null;
  setActiveInstance: (id: string | null) => void;
  highlightEntity: (id: EntityId | null) => void;
}

// Tracks the pending auto-clear timer so a new highlight cancels the previous
// one — otherwise an earlier timer fires and clears the newer highlight early.
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

export const useCanvasStore = create<CanvasState>((set) => ({
  activeInstanceId: null,
  highlightedEntity: null,
  setActiveInstance: (id) => set({ activeInstanceId: id }),
  highlightEntity: (id) => {
    if (highlightTimer) clearTimeout(highlightTimer);
    set({ highlightedEntity: id });
    if (id) {
      highlightTimer = setTimeout(() => set({ highlightedEntity: null }), 1800);
    }
  },
}));
