/**
 * IpDiffBadge.test.tsx — covers the IP-diff badge that compares current endpoint
 * IPs against the snapshot of the last APPROVED request: added (+) and removed (−)
 * badge states, plus the null branches (no diff, no approved history, malformed
 * snapshot). useApprovalHistory and useEndpoints are mocked per test via vi.fn so
 * each case can return its own history/endpoint shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';

interface HistoryRow {
  status: string;
  snapshot_json: unknown;
}
interface EndpointRow {
  ipAddresses?: { ip: string }[];
}

const historyMock = vi.fn<[], { data: HistoryRow[] }>();
const endpointsMock = vi.fn<[], { data: EndpointRow[] }>();

vi.mock('../../../hooks/useApproval', () => ({
  useApprovalHistory: () => historyMock(),
}));
vi.mock('../../../hooks/useEndpoints', () => ({
  useEndpoints: () => endpointsMock(),
}));

import { IpDiffBadge } from '../IpDiffBadge';

function approvedSnapshot(ips: string[]): HistoryRow {
  return {
    status: 'APPROVED',
    snapshot_json: {
      endpoints: [{ ipAddresses: ips.map((ip) => ({ ip })) }],
    },
  };
}

function currentEndpoints(ips: string[]): EndpointRow[] {
  return [{ ipAddresses: ips.map((ip) => ({ ip })) }];
}

describe('IpDiffBadge', () => {
  beforeEach(() => {
    historyMock.mockReset();
    endpointsMock.mockReset();
  });

  it('shows added IPs as a "+" badge and not as removed', () => {
    historyMock.mockReturnValue({ data: [approvedSnapshot(['10.0.0.1'])] });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.1', '10.0.0.2']) });

    renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(screen.getByText('IP Changes since last approval')).toBeInTheDocument();
    expect(screen.getByText('+ 10.0.0.2')).toBeInTheDocument();
    // The unchanged IP must not be shown as added or removed.
    expect(screen.queryByText('+ 10.0.0.1')).not.toBeInTheDocument();
    expect(screen.queryByText('− 10.0.0.1')).not.toBeInTheDocument();
  });

  it('shows removed IPs as a "−" badge', () => {
    historyMock.mockReturnValue({ data: [approvedSnapshot(['10.0.0.1', '10.0.0.9'])] });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.1']) });

    renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(screen.getByText('IP Changes since last approval')).toBeInTheDocument();
    expect(screen.getByText('− 10.0.0.9')).toBeInTheDocument();
    expect(screen.queryByText('+ 10.0.0.9')).not.toBeInTheDocument();
  });

  it('shows both an added and a removed badge together', () => {
    historyMock.mockReturnValue({ data: [approvedSnapshot(['10.0.0.1'])] });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.2']) });

    renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(screen.getByText('+ 10.0.0.2')).toBeInTheDocument();
    expect(screen.getByText('− 10.0.0.1')).toBeInTheDocument();
  });

  it('renders nothing when current IPs equal the last-approved snapshot (no diff)', () => {
    historyMock.mockReturnValue({ data: [approvedSnapshot(['10.0.0.1', '10.0.0.2'])] });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.1', '10.0.0.2']) });

    const { container } = renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(screen.queryByText('IP Changes since last approval')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no APPROVED request in history', () => {
    historyMock.mockReturnValue({
      data: [{ status: 'PENDING', snapshot_json: { endpoints: [] } }],
    });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.1']) });

    const { container } = renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the approved snapshot JSON is malformed', () => {
    historyMock.mockReturnValue({
      data: [{ status: 'APPROVED', snapshot_json: '{not valid json' }],
    });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.1']) });

    const { container } = renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('parses a stringified snapshot and diffs against it', () => {
    historyMock.mockReturnValue({
      data: [
        {
          status: 'APPROVED',
          snapshot_json: JSON.stringify({ endpoints: [{ ips: [{ ip: '10.0.0.1' }] }] }),
        },
      ],
    });
    endpointsMock.mockReturnValue({ data: currentEndpoints(['10.0.0.2']) });

    renderWithProviders(<IpDiffBadge instanceId="i1" />);

    expect(screen.getByText('+ 10.0.0.2')).toBeInTheDocument();
    expect(screen.getByText('− 10.0.0.1')).toBeInTheDocument();
  });
});
