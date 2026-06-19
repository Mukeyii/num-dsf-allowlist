/**
 * i18nFormValidation.test.tsx — end-to-end proof that Zod schemas emit stable
 * i18n key codes and FormField resolves them to localized text. Submitting an
 * empty OrganizationModal triggers the schema; the rendered errors must be the
 * translated strings, never the raw key codes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { useI18n } from '../../../stores/i18n.store';

vi.mock('../../../hooks/useOrganization', () => ({
  useUpdateOrganization: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

import { OrganizationModal } from '../OrganizationModal';

describe('translated form-validation messages', () => {
  afterEach(() => {
    useI18n.getState().setLang('en');
  });

  it('resolves schema error codes to English text, not the raw code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationModal open onClose={() => {}} instanceId="i1" />, {
      lang: 'en',
    });
    await user.click(screen.getByRole('button', { name: /save organization/i }));
    // The schema emits 'nameRequired'; FormField must render the localized string.
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.queryByText('nameRequired')).not.toBeInTheDocument();
  });

  it('resolves schema error codes to German text when lang is de', async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationModal open onClose={() => {}} instanceId="i1" />, {
      lang: 'de',
    });
    await user.click(screen.getByRole('button', { name: /organisation speichern/i }));
    expect(await screen.findByText('Name ist erforderlich')).toBeInTheDocument();
    expect(screen.queryByText('nameRequired')).not.toBeInTheDocument();
  });
});
