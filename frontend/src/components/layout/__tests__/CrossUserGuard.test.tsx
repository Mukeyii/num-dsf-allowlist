/**
 * CrossUserGuard.test.tsx — exercises the cross-user guard contract end to end:
 * the provider, the useCrossUserGuard hook, and the CrossUserConfirmDialog.
 *
 * The provider reads the active instance from the canvas store and the current
 * user via useMe/useInstance, so those two hooks are mocked and the canvas
 * store's activeInstanceId is set per test.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { CrossUserGuardProvider } from '../CrossUserGuardProvider';
import { useCrossUserGuard } from '../../../hooks/useCrossUserGuard';
import { useCanvasStore } from '../../../stores/canvas.store';

// Mutable identity/instance fixtures the mocked hooks read from.
let me: { email: string; isAdmin: boolean } | undefined = {
  email: 'admin@imi-test.example.de',
  isAdmin: true,
};
let instance: { id: string; label: string; owner_email?: string | null } | undefined = {
  id: 'i1',
  label: 'Foreign',
  owner_email: 'someone-else@example.de',
};

vi.mock('../../../hooks/useMe', () => ({
  useMe: () => ({ data: me, isLoading: false }),
}));
vi.mock('../../../hooks/useInstance', () => ({
  useInstance: () => ({ data: instance, isLoading: false }),
}));

// A minimal consumer that invokes the guard with the supplied action when its
// button is clicked — this is how real cards trigger guarded mutations.
function GuardedButton({ action }: { action: () => void }) {
  const guard = useCrossUserGuard();
  return (
    <button type="button" onClick={() => guard(action)}>
      Save changes
    </button>
  );
}

function renderGuard(action: () => void) {
  return renderWithProviders(
    <CrossUserGuardProvider>
      <GuardedButton action={action} />
    </CrossUserGuardProvider>,
  );
}

describe('CrossUserGuard', () => {
  beforeEach(() => {
    // Default: admin acting on an instance owned by someone else.
    me = { email: 'admin@imi-test.example.de', isAdmin: true };
    instance = { id: 'i1', label: 'Foreign', owner_email: 'someone-else@example.de' };
    useCanvasStore.setState({ activeInstanceId: 'i1' });
  });

  it('runs the action immediately without a dialog when the acting user owns the instance', async () => {
    // Owner email matches the current user → not a cross-user action.
    instance = { id: 'i1', label: 'Mine', owner_email: 'admin@imi-test.example.de' };
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs the action immediately for a non-admin user even when the owner differs', async () => {
    me = { email: 'member@imi-test.example.de', isAdmin: false };
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the confirm dialog instead of running the action for a cross-user action', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const dialog = await screen.findByRole('dialog', undefined, { timeout: 4000 });
    expect(dialog).toBeInTheDocument();
    // The action is queued, not executed, until the admin confirms.
    expect(action).not.toHaveBeenCalled();
    // The owner email is surfaced in the dialog body so the admin knows whose
    // data they are about to touch.
    expect(screen.getByText(/someone-else@example\.de/)).toBeInTheDocument();
    expect(screen.getByText(/Modify another user's data\?/i)).toBeInTheDocument();
  });

  it('runs the queued action and closes the dialog when the admin confirms', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByRole('dialog', undefined, { timeout: 4000 });
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1), { timeout: 4000 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
  });

  it('aborts the action and closes the dialog when the admin cancels', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByRole('dialog', undefined, { timeout: 4000 });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('aborts the action when Escape is pressed', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByRole('dialog', undefined, { timeout: 4000 });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('wires accessibility: the dialog is labelled by its title and the cancel button is focused', async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderGuard(action);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    const dialog = await screen.findByRole('dialog', undefined, { timeout: 4000 });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // aria-labelledby points at the heading that carries the same id.
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = screen.getByRole('heading', { name: /Modify another user's data\?/i });
    expect(heading).toHaveAttribute('id', labelledBy);

    // The cancel button receives focus on open so a stray Enter does not
    // accidentally confirm the cross-user mutation.
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus(), {
      timeout: 4000,
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('falls back to the default guard (runs directly, no dialog) when no provider is mounted', async () => {
    // Rendering the consumer without CrossUserGuardProvider uses the context
    // default, which executes the action immediately.
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<GuardedButton action={action} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
