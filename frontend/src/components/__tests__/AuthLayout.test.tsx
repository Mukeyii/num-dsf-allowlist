/**
 * AuthLayout.test.tsx — shared auth-page shell. Covers branding (IMI logo,
 * "dsf." wordmark, "Allow List Management"), the title/subtitle, children
 * rendering inside the card, and both environment-badge branches.
 *
 * The component reads `import.meta.env.VITE_DSF_ENVIRONMENT` at module load
 * into module-level constants, so the PRODUCTION branch is exercised by
 * stubbing the env, resetting the module registry, and re-importing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadAuthLayout() {
  vi.resetModules();
  return (await import('../AuthLayout')).AuthLayout;
}

describe('AuthLayout', () => {
  it('renders branding, the IMI logo, title/subtitle and children', async () => {
    const AuthLayout = await loadAuthLayout();
    render(
      <AuthLayout title="Sign in" subtitle="Enter your email to continue">
        <button type="button">Request code</button>
      </AuthLayout>,
    );

    // Wordmark + product line.
    expect(screen.getByText('dsf.')).toBeInTheDocument();
    expect(screen.getByText('Allow List Management')).toBeInTheDocument();

    // IMI logo (linked to the institute).
    const logo = screen.getByAltText('Institute of Medical Informatics');
    expect(logo).toHaveAttribute('src', '/logos/IMI-Logo-grad-eng.png');

    // Title + subtitle passed via props.
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Enter your email to continue')).toBeInTheDocument();

    // Children render inside the card.
    expect(screen.getByRole('button', { name: 'Request code' })).toBeInTheDocument();

    // Impressum footer link.
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
      'href',
      'https://medic.uni-muenster.de/impressum/',
    );
  });

  it('omits the subtitle paragraph when none is provided', async () => {
    const AuthLayout = await loadAuthLayout();
    render(
      <AuthLayout title="One-time code">
        <span>inner</span>
      </AuthLayout>,
    );

    expect(screen.getByRole('heading', { name: 'One-time code' })).toBeInTheDocument();
    expect(screen.getByText('inner')).toBeInTheDocument();
    // No subtitle text leaked when the prop is absent.
    expect(screen.queryByText('Enter your email to continue')).not.toBeInTheDocument();
  });

  it('shows the TEST badge with the teal accent by default', async () => {
    const AuthLayout = await loadAuthLayout();
    render(
      <AuthLayout title="Sign in">
        <span>child</span>
      </AuthLayout>,
    );

    const badge = screen.getByText('TEST');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#115e59' });
    expect(screen.queryByText('PRODUCTION')).not.toBeInTheDocument();
  });

  it('shows the PRODUCTION badge with the blue accent when configured', async () => {
    vi.stubEnv('VITE_DSF_ENVIRONMENT', 'PRODUCTION');
    const AuthLayout = await loadAuthLayout();
    render(
      <AuthLayout title="Sign in">
        <span>child</span>
      </AuthLayout>,
    );

    const badge = screen.getByText('PRODUCTION');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#4a90d9' });
    expect(screen.queryByText('TEST')).not.toBeInTheDocument();
  });
});
