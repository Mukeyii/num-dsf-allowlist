/**
 * SkillPage.test.tsx — the downloadable DSF process-skill page. Asserts the
 * heading renders, the download anchor points at the packaged .zip with a
 * download attribute, and the docs link opens safely in a new tab. Default
 * language is English (no `dsf-lang` in localStorage).
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { SkillPage } from '../SkillPage';

describe('SkillPage', () => {
  it('renders the title and the "what is inside" section', () => {
    renderWithProviders(<SkillPage />);
    expect(
      screen.getByRole('heading', { name: 'DSF Process Skill for Claude' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What’s inside' })).toBeInTheDocument();
  });

  it('offers the packaged skill as a download', () => {
    renderWithProviders(<SkillPage />);
    const download = screen.getByRole('link', { name: /Download skill/i });
    expect(download).toHaveAttribute('href', '/downloads/dsf-process-creator-skill.zip');
    expect(download).toHaveAttribute('download');
  });

  it('links to the DSF API v2 docs safely in a new tab', () => {
    renderWithProviders(<SkillPage />);
    const docs = screen.getByRole('link', { name: /DSF Process API v2 documentation/i });
    expect(docs).toHaveAttribute('href', 'https://dsf.dev/process-development/api-v2/');
    expect(docs).toHaveAttribute('target', '_blank');
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
