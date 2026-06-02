/**
 * canvas.store.test.ts — pure test for the canvas store: which DSF instance is
 * currently active on the entity graph.
 */
import { describe, it, expect } from 'vitest';
import { useCanvasStore } from '../canvas.store';

describe('useCanvasStore', () => {
  it('updates the active instance id', () => {
    useCanvasStore.getState().setActiveInstance('inst-42');
    expect(useCanvasStore.getState().activeInstanceId).toBe('inst-42');
  });

  it('replaces the active instance on a second call', () => {
    useCanvasStore.getState().setActiveInstance('inst-1');
    useCanvasStore.getState().setActiveInstance('inst-2');
    expect(useCanvasStore.getState().activeInstanceId).toBe('inst-2');
  });
});
