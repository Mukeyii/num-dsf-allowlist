/**
 * RequestCard.tsx — Admin approval request card with TOTP-gated approve/reject
 * controls + expandable snapshot viewer. Extracted from pages/AdminPage.tsx
 * (project 500-line file limit).
 *
 * Dependencies: useAdmin (approve/reject mutations), useI18n, sonner toast.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useApproveRequest, useRejectRequest } from '../../hooks/useAdmin';
import type { ApprovalSignature } from '../../api/admin.api';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';
import { relTime } from '../../lib/dateUtils';
import { parseSnapshot } from './parseSnapshot';
import { SnapshotView } from './SnapshotView';

interface RequestCardProps {
  request: {
    id: string;
    status: string;
    created_at?: string;
    submitted_at?: string;
    snapshot_json: string | object | null;
    signatures: ApprovalSignature[];
  };
  meEmail: string | null;
}

export type { RequestCardProps };

export function RequestCard({ request, meEmail }: RequestCardProps) {
  const { t } = useI18n();

  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const approveMut = useApproveRequest();
  const rejectMut = useRejectRequest();

  const snapshot = parseSnapshot(request.snapshot_json);
  const orgName = snapshot.organization?.name ?? '—';
  const orgId = snapshot.organization?.identifier ?? '—';
  const timeStr = request.submitted_at ?? request.created_at ?? '';

  const sigs = request.signatures ?? [];
  const approvals = sigs.filter((s) => s.decision === 'APPROVE');
  const meSite = meEmail ? (meEmail.split('@')[1]?.toLowerCase() ?? '') : '';
  const alreadyDecidedByMe =
    !!meEmail && sigs.some((s) => s.admin_email.toLowerCase() === meEmail.toLowerCase());
  const sameSiteApprovalExists = !!meSite && approvals.some((s) => s.admin_site === meSite);
  const approveDisabled =
    approvals.length >= 2 ||
    alreadyDecidedByMe ||
    sameSiteApprovalExists ||
    approveMut.isPending ||
    rejectMut.isPending;
  const silentConsentDate = approvals[0]
    ? new Date(new Date(approvals[0].signed_at).getTime() + 7 * 86400_000)
    : null;

  async function handleApprove() {
    if (approveMut.isPending || rejectMut.isPending) return;
    if (!totpCode || totpCode.length !== 6) {
      toast.error(t('adminToastTotpRequired'));
      return;
    }
    try {
      await approveMut.mutateAsync({ requestId: request.id, totpCode });
      toast.success(t('adminToastApproveSuccess'));
      setTotpCode('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('adminToastApproveFailed'));
      toast.error(msg);
    }
  }

  async function handleReject() {
    if (approveMut.isPending || rejectMut.isPending) return;
    if (!comment.trim()) {
      toast.error(t('adminToastReasonRequired'));
      return;
    }
    if (!totpCode || totpCode.length !== 6) {
      toast.error(t('adminToastTotpRequired'));
      return;
    }
    try {
      await rejectMut.mutateAsync({ requestId: request.id, comment: comment.trim(), totpCode });
      toast.success(t('adminToastRejectSuccess'));
      setRejecting(false);
      setComment('');
      setTotpCode('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('adminToastRejectFailed'));
      toast.error(msg);
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {orgName}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: 'var(--accent)',
                background: '#ede9ff',
                padding: '2px 8px',
                borderRadius: '6px',
              }}
            >
              {orgId}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#b45309',
                background: '#fef3c7',
                padding: '2px 8px',
                borderRadius: '20px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {t('pending')}
            </span>
            {timeStr && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {relTime(timeStr, t)}
              </span>
            )}
          </div>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('adminApprovals', { n: approvals.length })}
            </span>
            {approvals.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#dcfce7',
                  color: '#166534',
                  fontFamily: 'monospace',
                }}
              >
                ✓ {s.admin_email} <span style={{ opacity: 0.6 }}>· {s.admin_site}</span>
              </span>
            ))}
            {silentConsentDate && approvals.length === 1 && (
              <span style={{ fontSize: '10px', color: '#c2410c', fontWeight: 600 }}>
                {t('adminAutoApproves', { date: silentConsentDate.toLocaleDateString() })}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleApprove}
            disabled={approveDisabled}
            title={
              approvals.length >= 2
                ? t('adminAlreadyApproved2')
                : alreadyDecidedByMe
                  ? t('adminAlreadyDecided')
                  : sameSiteApprovalExists
                    ? t('adminSameSiteApproval')
                    : undefined
            }
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: 'none',
              background: approveDisabled ? '#86efac' : '#22c55e',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: approveDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'opacity 0.15s',
            }}
          >
            {approveMut.isPending ? t('adminApprovingBtn') : t('adminApproveBtn')}
          </button>
          {!rejecting ? (
            <button
              onClick={() => setRejecting(true)}
              disabled={approveMut.isPending || rejectMut.isPending}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1.5px solid #ef4444',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 600,
                cursor: approveMut.isPending || rejectMut.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              {t('adminRejectBtn')}
            </button>
          ) : null}
        </div>
      </div>

      {/* Reject comment panel */}
      {rejecting && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <label
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#b91c1c',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {t('adminRejectionReasonLabel')}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('adminRejectionReasonPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, system-ui, sans-serif',
              color: 'var(--text-primary)',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleReject}
              disabled={rejectMut.isPending}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: 'none',
                background: rejectMut.isPending ? '#fca5a5' : '#ef4444',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: rejectMut.isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {rejectMut.isPending ? t('adminRejectingBtn') : t('adminConfirmRejectBtn')}
            </button>
            <button
              onClick={() => {
                setRejecting(false);
                setComment('');
              }}
              disabled={rejectMut.isPending}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* TOTP confirmation input */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '18px', color: 'var(--accent)' }}
        >
          lock
        </span>
        <input
          type="text"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('adminTotpPlaceholder')}
          maxLength={6}
          style={{
            width: '180px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            fontSize: '14px',
            fontFamily: 'monospace',
            letterSpacing: '4px',
            textAlign: 'center',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {t('adminTotpRequired')}
        </span>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          background: 'var(--bg-card)',
          color: '#6b7280',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        {expanded ? t('adminHideDetails') : t('adminViewDetails')}
      </button>

      {/* Snapshot viewer */}
      {expanded && <SnapshotView snapshot={snapshot} t={t} />}
    </div>
  );
}
