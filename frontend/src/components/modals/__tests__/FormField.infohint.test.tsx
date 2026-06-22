import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormField } from '../FormField';
describe('FormField infoKey', () => {
  it('renders an InfoHint next to the label when infoKey is set', () => {
    render(
      <FormField label="Roles" infoKey="glossaryRoles">
        <input aria-label="roles-input" />
      </FormField>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
  it('renders no InfoHint when infoKey is absent', () => {
    render(
      <FormField label="Plain">
        <input aria-label="plain" />
      </FormField>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
