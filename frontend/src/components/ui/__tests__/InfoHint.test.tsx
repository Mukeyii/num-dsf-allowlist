import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InfoHint } from '../InfoHint';

describe('InfoHint', () => {
  it('is hidden until activated, then shows the text and is dismissible', () => {
    render(<InfoHint text="Data Integration Center" label="Was ist DIC?" />);
    const btn = screen.getByRole('button', { name: 'Was ist DIC?' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Data Integration Center');
    expect(btn).toHaveAttribute('aria-describedby', tip.id);
    fireEvent.keyDown(btn, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
