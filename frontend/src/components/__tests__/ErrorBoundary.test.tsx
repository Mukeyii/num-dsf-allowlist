import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the fallback UI when a child throws', () => {
    // React logs the caught error to console.error; suppress the expected noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    renderWithProviders(
      <ErrorBoundary>
        <div>healthy child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy child')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});
