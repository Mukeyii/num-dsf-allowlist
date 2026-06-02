/**
 * AdminUsersPage.tsx – /app/admin/users
 * Whitelist + admin-grant management. All actions require TOTP confirmation.
 * Dependencies: adminUsersApi, useI18n, useMe, tanstack-query, sonner
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminUsersApi, adminPromotionsApi, type WhitelistEntry } from '../api/admin.api';
import { useI18n } from '../stores/i18n.store';
import { useMe } from '../hooks/useMe';
import { useToastMutation } from '../hooks/useToastMutation';

type ActionKind = 'add' | 'lock' | 'unlock' | 'demote' | 'remove' | 'promote';

interface PendingAction {
  kind: ActionKind;
  email?: string;
}

export function AdminUsersPage() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminUsersApi.list,
    staleTime: 15_000,
  });

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [lockReason, setLockReason] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });

  const mutAdd = useToastMutation({
    mutationFn: (vars: { email: string; totpCode: string }) =>
      adminUsersApi.add(vars.email, vars.totpCode),
    successMessage: t('adminUsersAddedToast'),
    onSuccess: invalidate,
  });

  const mutLock = useToastMutation({
    mutationFn: (vars: { email: string; reason: string; totpCode: string }) =>
      adminUsersApi.lock(vars.email, vars.reason, vars.totpCode),
    successMessage: t('adminUsersLockedToast'),
    onSuccess: invalidate,
  });

  const mutUnlock = useToastMutation({
    mutationFn: (vars: { email: string; totpCode: string }) =>
      adminUsersApi.unlock(vars.email, vars.totpCode),
    successMessage: t('adminUsersUnlockedToast'),
    onSuccess: invalidate,
  });

  const mutDemote = useToastMutation({
    mutationFn: (vars: { email: string; totpCode: string }) =>
      adminUsersApi.demote(vars.email, vars.totpCode),
    successMessage: t('adminUsersDemotedToast'),
    onSuccess: invalidate,
  });

  const mutRemove = useToastMutation({
    mutationFn: (vars: { email: string; totpCode: string }) =>
      adminUsersApi.remove(vars.email, vars.totpCode),
    successMessage: t('adminUsersRemovedToast'),
    onSuccess: invalidate,
  });

  const mutPromote = useToastMutation({
    mutationFn: (vars: { email: string; totpCode: string }) =>
      adminPromotionsApi.create(vars.email, vars.totpCode),
    successMessage: t('adminUsersPromoteRequestedToast'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });

  if (me && !me.isAdmin) return <Navigate to="/app" replace />;

  function reset() {
    setPending(null);
    setTotpCode('');
    setLockReason('');
    setNewEmail('');
  }

  function execute() {
    if (!pending || totpCode.length !== 6) {
      toast.error(t('totpRequired'));
      return;
    }
    if (pending.kind === 'add') {
      mutAdd.mutate({ email: newEmail, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'lock') {
      mutLock.mutate({ email: pending.email!, reason: lockReason, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'unlock') {
      mutUnlock.mutate({ email: pending.email!, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'demote') {
      mutDemote.mutate({ email: pending.email!, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'remove') {
      mutRemove.mutate({ email: pending.email!, totpCode }, { onSettled: reset });
    } else if (pending.kind === 'promote') {
      mutPromote.mutate({ email: pending.email!, totpCode }, { onSettled: reset });
    }
  }

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#b01e66' }}>group</span>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('adminUsersTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {t('adminUsersSubtitle')}
          </p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 24px' }} />

      {/* Add row */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}>
        <input
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          placeholder={t('adminUsersAddPlaceholder')}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--bg-page)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={() => {
            if (!newEmail) { toast.error(t('adminUsersAddPlaceholder')); return; }
            setPending({ kind: 'add' });
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: 'none',
            background: '#b01e66',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('adminUsersAdd')}
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>}

      {users && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)' }}>
                <th style={th}>{t('adminUsersColEmail')}</th>
                <th style={th}>{t('adminUsersColRole')}</th>
                <th style={th}>{t('adminUsersColStatus')}</th>
                <th style={th}>{t('adminUsersColAddedBy')}</th>
                <th style={th}>{t('adminUsersColActions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <Row
                  key={u.email}
                  u={u}
                  meEmail={me?.email ?? null}
                  onAction={(kind) => setPending({ kind, email: u.email })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <ConfirmModal
          onClose={reset}
          title={t(`adminUsersConfirm_${pending.kind}` as Parameters<typeof t>[0])}
          subtitle={pending.email ?? newEmail}
        >
          {pending.kind === 'lock' && (
            <textarea
              value={lockReason}
              onChange={e => setLockReason(e.target.value)}
              placeholder={t('adminUsersLockReasonPlaceholder')}
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
            <button onClick={reset} style={cancelBtn}>{t('cancel')}</button>
            <button onClick={execute} style={confirmBtn}>{t('confirm')}</button>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

function Row({
  u,
  meEmail,
  onAction,
}: {
  u: WhitelistEntry;
  meEmail: string | null;
  onAction: (k: ActionKind) => void;
}) {
  const { t } = useI18n();
  const isMe = meEmail != null && u.email.toLowerCase() === meEmail.toLowerCase();
  const isLocked = u.locked_at != null;

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td style={td}>
        {u.email}
        {isMe && (
          <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
            ({t('adminUsersYou')})
          </span>
        )}
      </td>
      <td style={td}>
        {u.is_admin
          ? <span style={{ fontWeight: 700, color: '#b01e66' }}>{t('adminUsersRoleAdmin')}</span>
          : <span style={{ color: 'var(--text-muted)' }}>{t('adminUsersRoleUser')}</span>}
      </td>
      <td style={td}>
        {isLocked
          ? (
            <span style={{
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '10px',
            }}>
              {t('adminUsersStatusLocked')}
            </span>
          )
          : (
            <span style={{ color: '#16a34a' }}>
              ● {t('adminUsersStatusActive')}
            </span>
          )}
      </td>
      <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
        {u.created_by ?? '—'}
      </td>
      <td style={td}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {!isLocked && !isMe && (
            <button onClick={() => onAction('lock')} style={actBtn}>{t('adminUsersLock')}</button>
          )}
          {isLocked && (
            <button onClick={() => onAction('unlock')} style={actBtn}>{t('adminUsersUnlock')}</button>
          )}
          {u.is_admin && !isMe && (
            <button onClick={() => onAction('demote')} style={actBtn}>{t('adminUsersDemote')}</button>
          )}
          {!u.is_admin && !isLocked && !isMe && (
            <button onClick={() => onAction('promote')} style={actBtn}>{t('adminUsersPromote')}</button>
          )}
          {!isMe && (
            <button onClick={() => onAction('remove')} style={{ ...actBtn, color: '#b91c1c' }}>
              {t('adminUsersRemove')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ConfirmModal({
  onClose,
  title,
  subtitle,
  children,
}: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '0 0 16px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: 'var(--text-secondary)',
  fontWeight: 700,
};
const td: React.CSSProperties = {
  padding: '10px 12px',
  color: 'var(--text-primary)',
};
const actBtn: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  borderRadius: '6px',
  fontSize: '11px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-primary)',
};
const confirmBtn: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '10px',
  border: 'none',
  background: '#b01e66',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
