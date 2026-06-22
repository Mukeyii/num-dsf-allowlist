/**
 * AdminUsersPage.test.tsx — admin whitelist + role manager. adminUsersApi.list
 * is mocked with two whitelist rows and useMe is mocked to an admin viewer.
 * Asserts the title and the mocked rows render, then drives the remove action
 * (open modal → enter 6-digit TOTP → confirm) and asserts adminUsersApi.remove
 * is called with the row email and the entered code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { WhitelistEntry } from '../../api/admin.api';

const useMe = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useMe', () => ({ useMe }));

const { listMock, addMock, removeMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  addMock: vi.fn().mockResolvedValue({ ok: true }),
  removeMock: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../api/admin.api', () => ({
  adminUsersApi: {
    list: listMock,
    add: addMock,
    lock: vi.fn(),
    unlock: vi.fn(),
    demote: vi.fn(),
    remove: removeMock,
  },
  adminPromotionsApi: {
    create: vi.fn().mockResolvedValue({ id: 'p1' }),
  },
}));

import { AdminUsersPage } from '../AdminUsersPage';

function users(): WhitelistEntry[] {
  return [
    {
      email: 'me@imi-a.example.de',
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'root@imi.example.de',
      locked_at: null,
      locked_by: null,
      locked_reason: null,
      is_admin: true,
    },
    {
      email: 'bob@imi-b.example.de',
      created_at: '2026-02-01T00:00:00Z',
      created_by: 'root@imi.example.de',
      locked_at: null,
      locked_by: null,
      locked_reason: null,
      is_admin: false,
    },
  ];
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockResolvedValue(users());
    addMock.mockClear();
    removeMock.mockClear();
    useMe.mockReturnValue({ data: { email: 'me@imi-a.example.de', isAdmin: true } });
  });

  it('renders the title and both whitelist rows from the mocked list', async () => {
    renderWithProviders(<AdminUsersPage />);

    expect(screen.getByRole('heading', { name: 'User management' })).toBeInTheDocument();

    // Both rows render from the mocked query data.
    expect(await screen.findByText('me@imi-a.example.de')).toBeInTheDocument();
    expect(screen.getByText('bob@imi-b.example.de')).toBeInTheDocument();

    // The admin row shows the Admin role; the viewer's own row is marked "(you)".
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it('removes a whitelisted user: confirm fires adminUsersApi.remove with the TOTP code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsersPage />);

    // Locate the non-self row and click its Remove action.
    const bobCell = await screen.findByText('bob@imi-b.example.de');
    const bobRow = bobCell.closest('tr') as HTMLTableRowElement;
    await user.click(within(bobRow).getByRole('button', { name: 'Remove' }));

    // Confirm modal opens with the row email as subtitle.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Remove from whitelist')).toBeInTheDocument();
    expect(within(dialog).getByText('bob@imi-b.example.de')).toBeInTheDocument();

    // Enter the 6-digit step-up code and confirm.
    const totpInput = within(dialog).getByPlaceholderText('000000');
    fireEvent.change(totpInput, { target: { value: '123456' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('bob@imi-b.example.de', '123456'), {
      timeout: 4000,
    });
  });

  it('adds a whitelisted email: confirm fires adminUsersApi.add with the new email and code', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsersPage />);
    await screen.findByText('bob@imi-b.example.de');

    const emailInput = screen.getByPlaceholderText('email@institution.de');
    fireEvent.change(emailInput, { target: { value: 'new@imi-c.example.de' } });
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Whitelist new email')).toBeInTheDocument();

    const totpInput = within(dialog).getByPlaceholderText('000000');
    fireEvent.change(totpInput, { target: { value: '654321' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(addMock).toHaveBeenCalledWith('new@imi-c.example.de', '654321'), {
      timeout: 4000,
    });
  });
});
