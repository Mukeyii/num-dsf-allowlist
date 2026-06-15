/**
 * canvas.store.test.ts — pure test for the canvas store: which DSF instance is
 * currently active on the entity graph.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('useCanvasStore highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    useCanvasStore.getState().highlightEntity(null);
    vi.useRealTimers();
  });

  it('auto-clears the highlight after 1800ms', () => {
    useCanvasStore.getState().highlightEntity('contacts');
    expect(useCanvasStore.getState().highlightedEntity).toBe('contacts');
    vi.advanceTimersByTime(1800);
    expect(useCanvasStore.getState().highlightedEntity).toBeNull();
  });

  it('a new highlight cancels the previous timer', () => {
    useCanvasStore.getState().highlightEntity('contacts');
    vi.advanceTimersByTime(1000); // first timer would fire at 1800
    useCanvasStore.getState().highlightEntity('endpoints');
    // The first timer must NOT clear the newer highlight at its original 1800.
    vi.advanceTimersByTime(800);
    expect(useCanvasStore.getState().highlightedEntity).toBe('endpoints');
    // The newer timer clears it 1800ms after the second call.
    vi.advanceTimersByTime(1000);
    expect(useCanvasStore.getState().highlightedEntity).toBeNull();
  });
});
