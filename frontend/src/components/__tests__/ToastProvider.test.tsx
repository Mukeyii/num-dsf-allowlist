import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ToastProvider } from '../ToastProvider';

describe('ToastProvider', () => {
  it('mounts the sonner Toaster without crashing', () => {
    // ToastProvider takes no children — it only mounts the sonner <Toaster/>.
    // sonner lazily renders its toaster region (into a portal) and may not emit
    // a DOM node until a toast is enqueued, so the meaningful assertion here is
    // that mounting the provider does not throw.
    expect(() => renderWithProviders(<ToastProvider />)).not.toThrow();
  });
});
