/**
 * AdminHelpPage.test.tsx — the static admin reference manual. Asserts the page
 * heading, the seven section headings, the in-page table-of-contents links with
 * their anchor hrefs, and the IMI affiliation line render with real English
 * i18n text. The page reads only the i18n store (no network), so the providers
 * supply the ambient context and no hooks need mocking. There is no admin gate
 * in this component — it is a plain reference page.
 */
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AdminHelpPage } from '../AdminHelpPage';

describe('AdminHelpPage', () => {
  it('renders the page title and subtitle', () => {
    renderWithProviders(<AdminHelpPage />, { route: '/app/admin/help' });
    expect(screen.getByRole('heading', { name: 'Admin Reference' })).toBeInTheDocument();
    expect(
      screen.getByText('Workflows, security mechanisms, and developer support.'),
    ).toBeInTheDocument();
  });

  it('renders all seven section headings', () => {
    renderWithProviders(<AdminHelpPage />, { route: '/app/admin/help' });
    expect(
      screen.getByRole('heading', { name: 'Approval workflow (4-eyes principle)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Editing instances you do not own' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bundle download' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Certificates' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in with a client certificate' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Support' })).toBeInTheDocument();
  });

  it('renders the table-of-contents links pointing at the section anchors', () => {
    renderWithProviders(<AdminHelpPage />, { route: '/app/admin/help' });
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('On this page')).toBeInTheDocument();

    const approvalLink = within(nav).getByRole('link', { name: 'Approval workflow' });
    expect(approvalLink).toHaveAttribute('href', '#approval');

    const crossUserLink = within(nav).getByRole('link', { name: 'Editing other users' });
    expect(crossUserLink).toHaveAttribute('href', '#crossUser');

    expect(within(nav).getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '#audit');
    expect(within(nav).getByRole('link', { name: 'Bundle download' })).toHaveAttribute(
      'href',
      '#download',
    );
    expect(within(nav).getByRole('link', { name: 'Certificates' })).toHaveAttribute(
      'href',
      '#certs',
    );
    expect(within(nav).getByRole('link', { name: 'mTLS sign-in' })).toHaveAttribute(
      'href',
      '#mtls',
    );
    expect(within(nav).getByRole('link', { name: 'Support' })).toHaveAttribute('href', '#support');
  });

  it('renders the support paragraph and the IMI affiliation line', () => {
    renderWithProviders(<AdminHelpPage />, { route: '/app/admin/help' });
    expect(
      screen.getByText('For operational issues, please reach out to the IMI operator team.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Institute of Medical Informatics, University of Münster'),
    ).toBeInTheDocument();
  });

  it('renders German section headings when language is de', () => {
    renderWithProviders(<AdminHelpPage />, { route: '/app/admin/help', lang: 'de' });
    // The title is translated, so the English heading must be absent.
    expect(screen.queryByRole('heading', { name: 'Admin Reference' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
