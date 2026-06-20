/**
 * ApprovalModal.tsx — review-and-submit modal for an instance approval request.
 * Runs a readiness checklist (org/endpoint/cert/MEDIC contact/membership) and submits via cross-user guard.
 */
import { useState } from 'react';
import React from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { ModalFooter } from './FormField';
import { parseJsonArray } from '../../lib/parseJsonArray';
import { useSubmitApproval } from '../../hooks/useApproval';
import { useOrganization } from '../../hooks/useOrganization';
import { useContacts } from '../../hooks/useContacts';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCertificates } from '../../hooks/useCertificates';
import { useMemberships } from '../../hooks/useMemberships';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-xs font-bold text-slate-700">{title}</span>
        <span className="material-symbols-outlined text-[18px] text-slate-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 font-medium">{k}</span>
      <span className="text-slate-700 font-semibold">{v}</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
}

export function ApprovalModal({ open, onClose, instanceId }: Props) {
  const { t } = useI18n();
  const { mutateAsync, isPending } = useSubmitApproval(instanceId);
  const guard = useCrossUserGuard();
  const { data: org } = useOrganization(instanceId);
  const { data: contacts = [] } = useContacts(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certs = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);

  const checks = [
    { label: t('approvalModalCheckOrg'), ok: !!org, icon: 'corporate_fare' },
    { label: t('approvalModalCheckEndpoint'), ok: endpoints.length > 0, icon: 'hub' },
    { label: t('approvalModalCheckCert'), ok: certs.length > 0, icon: 'verified_user' },
    {
      label: t('approvalModalCheckMedic'),
      ok: contacts.some((c: any) => parseJsonArray(c.types).includes('MEDIC')),
      icon: 'contact_phone',
    },
    { label: t('approvalModalCheckMembership'), ok: memberships.length > 0, icon: 'groups' },
  ];

  const allPassed = checks.every((c) => c.ok);

  async function handleSubmit() {
    try {
      await new Promise<void>((resolve, reject) => {
        guard(async () => {
          try {
            await mutateAsync();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
      toast.success(t('approvalModalSubmitSuccess'));
      onClose();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, '');
      if (msg.includes('ALREADY_PENDING')) {
        toast.error(t('approvalModalAlreadyPending'));
      } else {
        toast.error(msg || t('approvalModalSubmitFailed'));
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={t('approvalModalTitle')}
      subtitle={t('approvalModalSubtitle')}
    >
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-700">{t('approvalModalPendingNote')}</p>
        </div>
        {/* Validation Checklist */}
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: allPassed ? '#f0fdf4' : '#fef2f2',
            borderRadius: '12px',
            border: `1px solid ${allPassed ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          <p
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: allPassed ? '#15803d' : '#991b1b',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {allPassed ? t('approvalModalAllPassed') : t('approvalModalSomeFailed')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', color: c.ok ? '#22c55e' : '#ef4444' }}
                >
                  {c.ok ? 'check_circle' : 'cancel'}
                </span>
                <span style={{ fontSize: '12px', color: c.ok ? 'var(--text-primary)' : '#991b1b' }}>
                  {c.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        {org && (
          <Section title={t('organization')}>
            <KV
              k={t('orgCardIdentifier')}
              v={<span className="mono-id text-primary">{org.identifier}</span>}
            />
            <KV k={t('orgCardName')} v={org.name} />
            <KV k={t('orgCardEmail')} v={org.email} />
            <KV k={t('orgCardCity')} v={`${org.city} · ${org.country_code}`} />
            <KV
              k={t('orgModalActiveLabel')}
              v={org.active ? t('approvalModalActive') : t('approvalModalInactive')}
            />
          </Section>
        )}
        <Section title={t('requestCardSectionContacts', { n: contacts.length })}>
          {contacts.length === 0 && (
            <p className="text-xs text-slate-400">{t('approvalModalNoContacts')}</p>
          )}
          {contacts.map((c: any) => (
            <div key={c.id} className="p-2 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold text-slate-700">{c.name || '—'}</p>
              <p className="text-[10px] text-slate-400">
                {parseJsonArray(c.types).join(' · ')} ·{' '}
                {c.email_validated ? t('contactEmailValidated') : t('contactEmailNotValidated')}
              </p>
            </div>
          ))}
        </Section>
        <Section title={t('requestCardSectionEndpoints', { n: endpoints.length })}>
          {endpoints.length === 0 && (
            <p className="text-xs text-slate-400">{t('approvalModalNoEndpoints')}</p>
          )}
          {endpoints.map((ep: any) => (
            <div key={ep.identifier} className="p-2 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold text-slate-700">{ep.name || ep.identifier}</p>
              <p className="text-[10px] font-mono text-slate-400">{ep.address}</p>
              <div className="flex gap-1 mt-1">
                {(ep.ipAddresses || []).map((ip: any) => (
                  <span
                    key={ip.id}
                    className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-mono"
                  >
                    {ip.ip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Section>
        <Section title={t('requestCardSectionCertificates', { n: certs.length })}>
          {certs.length === 0 && (
            <p className="text-xs text-slate-400">{t('approvalModalNoCerts')}</p>
          )}
          {certs.map((c: any) => (
            <div key={c.id} className="p-2 bg-slate-50 rounded-lg">
              <p className="mono-id text-[11px] text-primary">{c.subject}</p>
              <p className="text-[10px] text-slate-400">
                {t('approvalModalExpires', { date: c.valid_until })}
              </p>
            </div>
          ))}
        </Section>
        <Section title={t('requestCardSectionMemberships', { n: memberships.length })}>
          {memberships.length === 0 && (
            <p className="text-xs text-slate-400">{t('approvalModalNoMemberships')}</p>
          )}
          {memberships.map((ms: any) => (
            <div
              key={ms.id}
              className="p-2 bg-slate-50 rounded-lg flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-700">{ms.parent_organization}</p>
                <p className="text-[10px] text-blue-600 font-bold">
                  {parseJsonArray(ms.roles).join(' · ')}
                </p>
              </div>
            </div>
          ))}
        </Section>
      </div>
      <ModalFooter
        onCancel={onClose}
        onSubmit={handleSubmit}
        loading={isPending}
        submitLabel={t('approvalModalSubmitBtn')}
        disabled={!allPassed}
      />
    </Modal>
  );
}
