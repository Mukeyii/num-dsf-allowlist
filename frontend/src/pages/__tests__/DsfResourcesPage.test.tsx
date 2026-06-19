/**
 * DsfResourcesPage.test.tsx — the static DSF resources page. Asserts the
 * category headings render and that a representative external link carries the
 * correct href plus safe target/rel attributes. Default language is English
 * (no `dsf-lang` in localStorage), so headings assert the English strings.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DsfResourcesPage } from '../DsfResourcesPage';

describe('DsfResourcesPage', () => {
  it('renders the four resource categories', () => {
    renderWithProviders(<DsfResourcesPage />);
    expect(screen.getByRole('heading', { name: 'Getting Started' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Process & FHIR Development' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ecosystem' })).toBeInTheDocument();
  });

  it('renders external links that open safely in a new tab', () => {
    renderWithProviders(<DsfResourcesPage />);
    const linter = screen.getByRole('link', { name: /DSF Linter/i });
    expect(linter).toHaveAttribute(
      'href',
      'https://dsf.dev/process-development/linter-tool/linter-tool.html',
    );
    expect(linter).toHaveAttribute('target', '_blank');
    expect(linter).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
