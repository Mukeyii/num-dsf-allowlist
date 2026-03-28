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

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
        <span className="text-xs font-bold text-slate-700">{title}</span>
        <span className="material-symbols-outlined text-[18px] text-slate-400">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && <div className="px-4 py-3 space-y-2">{children}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (<div className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
    <span className="text-slate-400 font-medium">{k}</span><span className="text-slate-700 font-semibold">{v}</span>
  </div>);
}

interface Props { open: boolean; onClose: () => void; instanceId: string; }

export function ApprovalModal({ open, onClose, instanceId }: Props) {
  const { mutateAsync, isPending } = useSubmitApproval(instanceId);
  const { data: org } = useOrganization(instanceId);
  const { data: contacts = [] } = useContacts(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certs = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);

  const checks = [
    { label: 'Organization configured', ok: !!org, icon: 'corporate_fare' },
    { label: 'At least 1 endpoint', ok: endpoints.length > 0, icon: 'hub' },
    { label: 'At least 1 certificate', ok: certs.length > 0, icon: 'verified_user' },
    { label: 'MEDIC contact assigned', ok: contacts.some((c: any) => {
      const types = Array.isArray(c.types) ? c.types : JSON.parse(c.types || '[]');
      return types.includes('MEDIC');
    }), icon: 'contact_phone' },
    { label: 'At least 1 membership', ok: memberships.length > 0, icon: 'groups' },
  ];

  const allPassed = checks.every(c => c.ok);

  async function handleSubmit() {
    try {
      await mutateAsync();
      toast.success('Approval request submitted to IMI.');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '';
      if (msg.includes('ALREADY_PENDING')) { toast.error('A pending approval request already exists.'); }
      else { toast.error(msg || 'Failed to submit approval request.'); }
    }
  }

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" title="Submit for Approval" subtitle="Review all data carefully. Changes will be sent to IMI for verification.">
      <div className="space-y-3">
        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <p className="text-xs text-indigo-700">Once submitted, the request status will show as <strong>PENDING</strong> until IMI approves or rejects it.</p>
        </div>
        {/* Validation Checklist */}
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: allPassed ? '#f0fdf4' : '#fef2f2', borderRadius: '12px', border: `1px solid ${allPassed ? '#bbf7d0' : '#fecaca'}` }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: allPassed ? '#15803d' : '#991b1b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {allPassed ? 'All checks passed' : 'Some checks failed'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: c.ok ? '#22c55e' : '#ef4444' }}>
                  {c.ok ? 'check_circle' : 'cancel'}
                </span>
                <span style={{ fontSize: '12px', color: c.ok ? 'var(--text-primary)' : '#991b1b' }}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        {org && (<Section title="Organization">
          <KV k="Identifier" v={<span className="mono-id text-primary">{org.identifier}</span>} />
          <KV k="Name" v={org.name} /><KV k="Email" v={org.email} />
          <KV k="City" v={`${org.city} · ${org.country_code}`} />
          <KV k="Active" v={org.active ? '✓ active' : '✗ inactive'} />
        </Section>)}
        <Section title={`Contacts (${contacts.length})`}>
          {contacts.length === 0 && <p className="text-xs text-slate-400">No contacts.</p>}
          {contacts.map((c: any) => (<div key={c.id} className="p-2 bg-slate-50 rounded-lg">
            <p className="text-xs font-bold text-slate-700">{c.name || '—'}</p>
            <p className="text-[10px] text-slate-400">{parseJsonArray(c.types).join(' · ')} · {c.email_validated ? '✓ validated' : '⚠ not validated'}</p>
          </div>))}
        </Section>
        <Section title={`Endpoints (${endpoints.length})`}>
          {endpoints.length === 0 && <p className="text-xs text-slate-400">No endpoints.</p>}
          {endpoints.map((ep: any) => (<div key={ep.identifier} className="p-2 bg-slate-50 rounded-lg">
            <p className="text-xs font-bold text-slate-700">{ep.name || ep.identifier}</p>
            <p className="text-[10px] font-mono text-slate-400">{ep.address}</p>
            <div className="flex gap-1 mt-1">{(ep.ipAddresses || []).map((ip: any) => (
              <span key={ip.id} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-mono">{ip.ip}</span>
            ))}</div>
          </div>))}
        </Section>
        <Section title={`Certificates (${certs.length})`}>
          {certs.length === 0 && <p className="text-xs text-slate-400">No certificates.</p>}
          {certs.map((c: any) => (<div key={c.id} className="p-2 bg-slate-50 rounded-lg">
            <p className="mono-id text-[11px] text-primary">{c.subject}</p>
            <p className="text-[10px] text-slate-400">Expires: {c.valid_until}</p>
          </div>))}
        </Section>
        <Section title={`Memberships (${memberships.length})`}>
          {memberships.length === 0 && <p className="text-xs text-slate-400">No memberships.</p>}
          {memberships.map((ms: any) => (<div key={ms.id} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between">
            <div><p className="text-xs font-bold text-slate-700">{ms.parent_organization}</p>
            <p className="text-[10px] text-blue-600 font-bold">{parseJsonArray(ms.roles).join(' · ')}</p></div>
          </div>))}
        </Section>
      </div>
      <ModalFooter onCancel={onClose} onSubmit={handleSubmit} loading={isPending} submitLabel="Send Request for Approval" disabled={!allPassed} />
    </Modal>
  );
}
