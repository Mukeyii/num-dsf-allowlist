/**
 * AdminPromotionsPage.tsx – /app/admin/promotions
 * Pending 4-eyes admin promotion requests. A second admin from a different
 * site approves or rejects. The requester can cancel.
 * Dependencies: adminPromotionsApi, useI18n, useMe, tanstack-query, sonner
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminPromotionsApi, type PromotionRequest } from '../api/admin.api';
import { useI18n } from '../stores/i18n.store';
import { useMe } from '../hooks/useMe';
import { getErrorMessage } from '../lib/getErrorMessage';
import { useToastMutation } from '../hooks/useToastMutation';

type ActionKind = 'approve' | 'reject' | 'cancel';

function siteOf(email: string): string {
  return (email.split('@')[1] || '').toLowerCase();
}

function relTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AdminPromotionsPage() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin', 'promotions'],
    queryFn: adminPromotionsApi.list,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const [pending, setPending] = useState<{ kind: ActionKind; req: PromotionRequest } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [reason, setReason] = useState('');

  const mutApprove = useMutation({
    mutationFn: (vars: { id: string; totpCode: string }) =>
      adminPromotionsApi.approve(vars.id, vars.totpCode),
    onSuccess: () => {
      toast.success(t('promotionApprovedToast'));
      qc.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Failed');
      toast.error(msg);
    },
  });

  const mutReject = useToastMutation({
    mutationFn: (vars: { id: string; reason: string; totpCode: string }) =>
      adminPromotionsApi.reject(vars.id, vars.reason, vars.totpCode),
    successMessage: t('promotionRejectedToast'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });

  const mutCancel = useToastMutation({
    mutationFn: (vars: { id: string; totpCode: string }) =>
      adminPromotionsApi.cancel(vars.id, vars.totpCode),
    successMessage: t('promotionCancelledToast'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });

  if (me && !me.isAdmin) return <Navigate to="/app" replace />;

  function reset() {
    setPending(null);
    setTotpCode('');
    setReason('');
  }

  function execute() {
    if (!pending || totpCode.length !== 6) {
      toast.error(t('totpRequired'));
      return;
    }
    if (pending.kind === 'approve') {
      mutApprove.mutate({ id: pending.req.id, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'reject') {
      if (!reason.trim()) {
        toast.error(t('adminPromotionsRejectReasonRequired'));
        return;
      }
      mutReject.mutate({ id: pending.req.id, reason, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'cancel') {
      mutCancel.mutate({ id: pending.req.id, totpCode }, { onSettled: reset });
    }
  }

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#b01e66' }}>verified_user</span>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('adminPromotionsTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('adminPromotionsSubtitle')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      <div style={{
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '20px',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#7c2d12' }}>
          {t('adminPromotionsRule')}
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#7c2d12' }}>
          {t('adminPromotionsRuleHint')}
        </p>
      </div>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>}
      {!isLoading && requests && requests.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>{t('adminPromotionsEmpty')}</p>
      )}

      {requests && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map(req => {
            const isMyRequest = me?.email != null &&
              req.requested_by.toLowerCase() === me.email.toLowerCase();
            const sameSiteAsRequester = me?.email != null &&
              siteOf(me.email) === siteOf(req.requested_by);
            const canApprove = !isMyRequest && !sameSiteAsRequester;

            return (
              <div
                key={req.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {req.target_email}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {t('adminPromotionsRequestedBy')}:{' '}
                      <span style={{ fontFamily: 'monospace' }}>{req.requested_by}</span>
                      {' · '}
                      <span>{relTime(req.requested_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {isMyRequest && (
                      <button
                        onClick={() => setPending({ kind: 'cancel', req })}
                        style={cancelActBtn}
                      >
                        {t('adminPromotionsCancel')}
                      </button>
                    )}
                    {!isMyRequest && (
                      <>
                        <button
                          disabled={!canApprove}
                          title={!canApprove ? t('adminPromotionsSameSiteHint') : ''}
                          onClick={() => setPending({ kind: 'approve', req })}
                          style={canApprove ? approveBtn : approveDisabledBtn}
                        >
                          {t('adminPromotionsApprove')}
                        </button>
                        <button
                          onClick={() => setPending({ kind: 'reject', req })}
                          style={rejectBtn}
                        >
                          {t('adminPromotionsReject')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={reset}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
            }}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {pending.kind === 'approve' && t('adminPromotionsConfirmApprove')}
              {pending.kind === 'reject' && t('adminPromotionsConfirmReject')}
              {pending.kind === 'cancel' && t('adminPromotionsConfirmCancel')}
            </h2>
            <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
              {pending.req.target_email}
            </p>
            {pending.kind === 'reject' && (
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('adminPromotionsRejectReasonPlaceholder')}
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '12px',
                  background: 'var(--bg-page)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            )}
            <input
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: '180px',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                letterSpacing: '4px',
                textAlign: 'center',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)',
              }}
            />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={reset} style={modalCancelBtn}>{t('cancel')}</button>
              <button onClick={execute} style={modalConfirmBtn}>{t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const approveBtn: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  background: '#16a34a',
  color: '#fff',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
const approveDisabledBtn: React.CSSProperties = {
  ...approveBtn,
  background: '#cbd5e1',
  cursor: 'not-allowed',
};
const rejectBtn: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid #ef4444',
  background: 'transparent',
  color: '#ef4444',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
const cancelActBtn: React.CSSProperties = {
  padding: '6px 14px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  borderRadius: '8px',
  fontSize: '12px',
  cursor: 'pointer',
};
const modalCancelBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-primary)',
};
const modalConfirmBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '10px',
  border: 'none',
  background: '#b01e66',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
