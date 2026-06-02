/**
 * modals.store.test.ts — drives the useModals zustand store via getState().
 * Verifies the initial closed state, openModal sets the active modal + editId,
 * and closeModal clears both. No rendering required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useModals } from '../../hooks/useModals';

describe('useModals store', () => {
  beforeEach(() => {
    useModals.getState().closeModal();
  });

  it('starts with no modal open', () => {
    expect(useModals.getState().open).toBeNull();
    expect(useModals.getState().editId).toBeNull();
  });

  it('openModal sets the active modal type', () => {
    useModals.getState().openModal('contact-add');
    expect(useModals.getState().open).toBe('contact-add');
    expect(useModals.getState().editId).toBeNull();
  });

  it('openModal stores the edit id when provided', () => {
    useModals.getState().openModal('contact-edit', 'c-42');
    expect(useModals.getState().open).toBe('contact-edit');
    expect(useModals.getState().editId).toBe('c-42');
  });

  it('closeModal clears the active modal and edit id', () => {
    useModals.getState().openModal('contact-edit', 'c-42');
    useModals.getState().closeModal();
    expect(useModals.getState().open).toBeNull();
    expect(useModals.getState().editId).toBeNull();
  });
});
