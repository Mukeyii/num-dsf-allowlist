/**
 * OnboardingWizard.tsx – Step-by-step onboarding guide for new organizations
 * Dependencies: useOrganization, useContacts, useEndpoints, useCertificates, useMemberships, useApproval, useModals
 */
import { useOrganization } from '../../hooks/useOrganization';
import { useContacts } from '../../hooks/useContacts';
import { useEndpoints } from '../../hooks/useEndpoints';
import { useCertificates } from '../../hooks/useCertificates';
import { useMemberships } from '../../hooks/useMemberships';
import { useApprovalStatus } from '../../hooks/useApproval';
import { useModals } from '../../hooks/useModals';

interface Props {
  instanceId: string;
}

export function OnboardingWizard({ instanceId }: Props) {
  const { data: org } = useOrganization(instanceId);
  const { data: contacts = [] } = useContacts(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certs = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);
  const { data: approval } = useApprovalStatus(instanceId);

  const steps = [
    { label: 'Organization', icon: 'corporate_fare', done: !!org, action: 'org-edit' as const, color: '#6c63ff' },
    { label: 'Contact', icon: 'contact_phone', done: contacts.length > 0, action: 'contact-add' as const, color: '#9b59b6' },
    { label: 'Endpoint', icon: 'hub', done: endpoints.length > 0, action: 'endpoint-add' as const, color: '#3ecfb2' },
    { label: 'Certificate', icon: 'verified_user', done: certs.length > 0, action: 'certificate-add' as const, color: '#f5a623' },
    { label: 'Membership', icon: 'groups', done: memberships.length > 0, action: 'membership-add' as const, color: '#4a90d9' },
    { label: 'Submit', icon: 'send', done: !!approval, action: 'approval' as const, color: '#e05c5c' },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  // Don't show wizard if all steps are complete
  if (allDone) return null;

  const nextStep = steps.find(s => !s.done);

  return (
    <div style={{
      margin: '0 0 16px', padding: '12px 16px',
      background: 'var(--bg-card)', borderRadius: '12px',
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px var(--shadow)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6c63ff' }}>rocket_launch</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Getting Started</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{completedCount}/{steps.length} complete</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: 'var(--bg-hover)', borderRadius: '99px', overflow: 'hidden', marginBottom: '10px' }}>
        <div style={{ width: `${(completedCount / steps.length) * 100}%`, height: '100%', background: '#6c63ff', borderRadius: '99px', transition: 'width 0.3s' }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {steps.map((step) => (
          <button
            key={step.label}
            onClick={() => { if (!step.done) useModals.getState().openModal(step.action); }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '6px 4px', borderRadius: '8px', border: 'none', cursor: step.done ? 'default' : 'pointer',
              background: step === nextStep ? 'var(--bg-hover)' : 'transparent',
              transition: 'background 0.15s', opacity: step.done ? 0.5 : 1,
            }}
          >
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: step.done ? '#22c55e' : step === nextStep ? step.color : 'var(--bg-hover)',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: '14px', color: step.done ? '#fff' : step === nextStep ? '#fff' : 'var(--text-muted)',
              }}>
                {step.done ? 'check' : step.icon}
              </span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, color: step.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {step.label}
            </span>
          </button>
        ))}
      </div>

    </div>
  );
}
