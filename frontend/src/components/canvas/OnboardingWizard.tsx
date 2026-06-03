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
import { useI18n } from '../../stores/i18n.store';

interface Props {
  instanceId: string;
}

export function OnboardingWizard({ instanceId }: Props) {
  const { t } = useI18n();
  const { data: org } = useOrganization(instanceId);
  const { data: contacts = [] } = useContacts(instanceId);
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const { data: certs = [] } = useCertificates(instanceId);
  const { data: memberships = [] } = useMemberships(instanceId);
  const { data: approval } = useApprovalStatus(instanceId);

  const steps = [
    {
      key: 'organization',
      label: t('onboardingStepOrganization'),
      icon: 'corporate_fare',
      done: !!org,
      action: 'org-edit' as const,
      color: '#b01e66',
    },
    {
      key: 'contact',
      label: t('onboardingStepContact'),
      icon: 'contact_phone',
      done: contacts.length > 0,
      action: 'contact-add' as const,
      color: '#9b59b6',
    },
    {
      key: 'endpoint',
      label: t('onboardingStepEndpoint'),
      icon: 'hub',
      done: endpoints.length > 0,
      action: 'endpoint-add' as const,
      color: '#3ecfb2',
    },
    {
      key: 'certificate',
      label: t('onboardingStepCertificate'),
      icon: 'verified_user',
      done: certs.length > 0,
      action: 'certificate-add' as const,
      color: '#f5a623',
    },
    {
      key: 'membership',
      label: t('onboardingStepMembership'),
      icon: 'groups',
      done: memberships.length > 0,
      action: 'membership-add' as const,
      color: '#4a90d9',
    },
    {
      key: 'submit',
      label: t('onboardingStepSubmit'),
      icon: 'send',
      done: !!approval,
      action: 'approval' as const,
      color: '#e05c5c',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Don't show wizard if all steps are complete
  if (allDone) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <div
      style={{
        margin: '0 0 16px',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 8px var(--shadow)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', color: '#b01e66' }}
          >
            rocket_launch
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('onboardingHeader')}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {t('onboardingProgress', { done: completedCount, total: steps.length })}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '3px',
          background: 'var(--bg-hover)',
          borderRadius: '99px',
          overflow: 'hidden',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            width: `${(completedCount / steps.length) * 100}%`,
            height: '100%',
            background: '#b01e66',
            borderRadius: '99px',
            transition: 'width 0.3s',
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {steps.map((step) => (
          <button
            key={step.key}
            onClick={() => {
              if (!step.done) useModals.getState().openModal(step.action);
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 4px',
              borderRadius: '8px',
              border: 'none',
              cursor: step.done ? 'default' : 'pointer',
              background: step === nextStep ? 'var(--bg-hover)' : 'transparent',
              transition: 'background 0.15s',
              opacity: step.done ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: step.done
                  ? '#22c55e'
                  : step === nextStep
                    ? step.color
                    : 'var(--bg-hover)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '14px',
                  color: step.done ? '#fff' : step === nextStep ? '#fff' : 'var(--text-muted)',
                }}
              >
                {step.done ? 'check' : step.icon}
              </span>
            </div>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 600,
                color: step.done ? 'var(--text-muted)' : 'var(--text-primary)',
              }}
            >
              {step.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
