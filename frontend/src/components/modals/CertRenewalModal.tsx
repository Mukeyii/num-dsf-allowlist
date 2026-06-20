/**
 * CertRenewalModal.tsx – Guided certificate renewal flow
 * Steps: 1. Select expiring cert → 2. Upload new PEM → 3. Compare → 4. Confirm swap
 * Dependencies: Modal, ModalFooter, useCertificates, daysUntil, sonner
 */
import { useState } from 'react';
import { Modal } from './Modal';
import { ModalFooter } from './FormField';
import { useCertificates, useRenewCertificate } from '../../hooks/useCertificates';
import { daysUntil } from '../../lib/dateUtils';
import { toast } from 'sonner';
import { useCrossUserGuard } from '../../hooks/useCrossUserGuard';
import { useI18n } from '../../stores/i18n.store';
import { getErrorMessage } from '../../lib/getErrorMessage';

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
}

export function CertRenewalModal({ open, onClose, instanceId }: Props) {
  const { t } = useI18n();
  const { data: certs = [] } = useCertificates(instanceId);
  const renewMut = useRenewCertificate(instanceId);
  const guard = useCrossUserGuard();

  const [step, setStep] = useState<'select' | 'upload' | 'confirm'>('select');
  const [selectedCertId, setSelectedCertId] = useState<string | null>(null);
  const [newPem, setNewPem] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const selectedCert = certs.find((c: any) => c.id === selectedCertId);

  function reset() {
    setStep('select');
    setSelectedCertId(null);
    setNewPem('');
    onClose();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewPem(reader.result as string);
    reader.readAsText(file);
  }

  async function handleConfirm() {
    if (!selectedCertId || !newPem.trim()) return;

    try {
      await new Promise<void>((resolve, reject) => {
        guard(async () => {
          try {
            await renewMut.mutateAsync({ certId: selectedCertId, pem: newPem });
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
      toast.success(t('certRenewalSuccess'));
      reset();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('certRenewalFailed')));
    }
  }

  // Sort certs by expiry (soonest first)
  const sortedCerts = [...certs].sort(
    (a: any, b: any) => new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime(),
  );

  return (
    <Modal open={open} onClose={reset} title={t('certRenewalTitle')} width="max-w-lg">
      {step === 'select' && (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('certRenewalSelectHint')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedCerts.map((cert: any) => {
              const days = daysUntil(cert.valid_until);
              const color = days < 30 ? '#ef4444' : days < 90 ? '#f5a623' : '#22c55e';
              return (
                <button
                  key={cert.id}
                  onClick={() => {
                    setSelectedCertId(cert.id);
                    setStep('upload');
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-hover)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}
                    >
                      {cert.subject}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      {t('certRenewalValidUntil', { date: cert.valid_until })}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: `${color}18`,
                    }}
                  >
                    {days < 0 ? 'EXPIRED' : `${days}d`}
                  </span>
                </button>
              );
            })}
            {sortedCerts.length === 0 && (
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                {t('certRenewalNoCerts')}
              </p>
            )}
          </div>
        </div>
      )}

      {step === 'upload' && selectedCert && (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {t('certRenewalReplacingLabel')}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{selectedCert.subject}</strong>
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? '#6c63ff' : 'var(--border)'}`,
              borderRadius: '10px',
              padding: '20px',
              textAlign: 'center',
              background: dragOver ? '#ede9ff' : 'transparent',
              marginBottom: '12px',
              transition: 'all 0.2s',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '32px',
                color: dragOver ? '#6c63ff' : 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              upload_file
            </span>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {t('certRenewalDropHint')}
            </p>
          </div>

          <textarea
            value={newPem}
            onChange={(e) => setNewPem(e.target.value)}
            placeholder={t('certRenewalPastePlaceholder')}
            rows={6}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              fontSize: '11px',
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
              color: 'var(--text-primary)',
              background: 'var(--bg-input)',
            }}
          />

          {newPem.includes('PRIVATE KEY') && (
            <div
              style={{
                padding: '8px 12px',
                background: '#fef2f2',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                marginTop: '8px',
              }}
            >
              <p style={{ fontSize: '11px', color: '#991b1b', margin: 0 }}>
                {t('certRenewalPrivateKeyError')}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => setStep('select')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {t('certRenewalBackBtn')}
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!newPem.trim() || newPem.includes('PRIVATE KEY')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background:
                  newPem.trim() && !newPem.includes('PRIVATE KEY') ? '#6c63ff' : 'var(--bg-hover)',
                color:
                  newPem.trim() && !newPem.includes('PRIVATE KEY') ? '#fff' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('certRenewalReviewBtn')}
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && selectedCert && (
        <div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            {t('certRenewalConfirmHint')}
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <p
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#991b1b',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}
              >
                {t('certRenewalRemovingLabel')}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-primary)', margin: 0 }}>
                {selectedCert.subject}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {t('certRenewalUntil', { date: selectedCert.valid_until })}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}
            >
              <p
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#15803d',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}
              >
                {t('certRenewalAddingLabel')}
              </p>
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  margin: 0,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {newPem.slice(0, 60)}...
              </p>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              background: 'var(--bg-hover)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              {t('certRenewalApprovalHint')}
            </p>
          </div>

          <ModalFooter
            onCancel={() => setStep('upload')}
            loading={renewMut.isPending}
            submitLabel={t('certRenewalConfirmBtn')}
            onSubmit={handleConfirm}
          />
        </div>
      )}
    </Modal>
  );
}
