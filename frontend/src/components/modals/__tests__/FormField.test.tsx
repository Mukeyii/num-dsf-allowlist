import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { FormField } from '../FormField';

describe('FormField', () => {
  it('renders its label and children', () => {
    renderWithProviders(
      <FormField label="Email Address">
        <input data-testid="the-input" />
      </FormField>,
    );
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByTestId('the-input')).toBeInTheDocument();
  });

  it('shows the error text when the error prop is set', () => {
    renderWithProviders(
      <FormField label="Email Address" error="This field is required">
        <input />
      </FormField>,
    );
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('does not show error text when no error is provided', () => {
    renderWithProviders(
      <FormField label="Email Address" hint="Some hint">
        <input />
      </FormField>,
    );
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    expect(screen.getByText('Some hint')).toBeInTheDocument();
  });

  it('resolves an error that is a known translation key', () => {
    // When a Zod schema emits a stable i18n key code as its message, FormField
    // resolves it to the localized string instead of rendering the raw code.
    renderWithProviders(
      <FormField label="Some Field" error="modalSaveBtn">
        <input />
      </FormField>,
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.queryByText('modalSaveBtn')).not.toBeInTheDocument();
  });
});
