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

export const useCanvasStore = create<CanvasState>((set) => ({
  activeInstanceId: null,
  highlightedEntity: null,
  setActiveInstance: (id) => set({ activeInstanceId: id }),
  highlightEntity: (id) => {
    set({ highlightedEntity: id });
    if (id) {
      setTimeout(() => set({ highlightedEntity: null }), 1800);
    }
  },
}));
