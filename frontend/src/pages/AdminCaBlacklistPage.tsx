/**
 * AdminCaBlacklistPage.tsx – Admin UI to manage the CA blacklist used by
 * the certificate-upload validation. Surfaces the Mozilla-CA cache as an
 * autocomplete datalist so admins do not have to type DNs by hand.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { caBlacklistApi, type CaBlacklistRow, type KnownCaRow } from '../api/caBlacklist.api';
import { useI18n } from '../stores/i18n.store';
import { getErrorMessage } from '../lib/getErrorMessage';

export function AdminCaBlacklistPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['ca-blacklist'],
    queryFn: () => caBlacklistApi.list().then(r => r.data.data),
  });
  const [subjectDn, setSubjectDn] = useState('');
  const [reason, setReason] = useState('');

  const addMut = useMutation({
    mutationFn: () => caBlacklistApi.add({ subjectDn, reason }).then(r => r.data),
    onSuccess: () => {
      setSubjectDn('');
      setReason('');
      toast.success(t('caBlacklistAddedToast'));
      qc.invalidateQueries({ queryKey: ['ca-blacklist'] });
    },
    onError: (err: any) =>
      toast.error(getErrorMessage(err, t('caBlacklistAddFailed'))),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => caBlacklistApi.remove(id),
    onSuccess: () => {
      toast.success(t('caBlacklistRemovedToast'));
      qc.invalidateQueries({ queryKey: ['ca-blacklist'] });
    },
  });

  const blacklist: CaBlacklistRow[] = data?.blacklist ?? [];
  const knownCas: KnownCaRow[] = data?.knownCas ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto" data-testid="admin-ca-blacklist">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('caBlacklistTitle')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {t('caBlacklistIntro')}
      </p>

      <section
        className="mb-8 p-4 rounded-xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('caBlacklistAdd')}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('caSubjectDn')}
            </span>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)' }}
              value={subjectDn}
              onChange={e => setSubjectDn(e.target.value)}
              list="known-cas"
              placeholder={t('caSubjectDnPlaceholder')}
              data-testid="ca-blacklist-subject-input"
            />
            <datalist id="known-cas">
              {knownCas.map(c => (
                <option key={c.fingerprint} value={c.subject_dn} />
              ))}
            </datalist>
          </label>
          <label className="flex-1">
            <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('caReason')}
            </span>
            <input
              className="w-full px-3 py-2 text-sm rounded-lg border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-input)' }}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('caReasonPlaceholder')}
            />
          </label>
          <button
            type="button"
            onClick={() => addMut.mutate()}
            disabled={!subjectDn || addMut.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#b01e66' }}
            data-testid="ca-blacklist-add-btn"
          >
            {addMut.isPending ? '…' : t('add')}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('caBlacklistEntries')}
        </h2>
        {isLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
        ) : blacklist.length === 0 ? (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            {t('caBlacklistEmpty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2 px-2 font-semibold">{t('caSubjectDn')}</th>
                <th className="text-left py-2 px-2 font-semibold">{t('caReason')}</th>
                <th className="text-left py-2 px-2 font-semibold">{t('caAddedBy')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blacklist.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2 px-2 font-mono text-xs">{r.subject_dn}</td>
                  <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.reason || '—'}
                  </td>
                  <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {r.added_by}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeMut.mutate(r.id)}
                      className="text-xs font-semibold underline"
                      style={{ color: '#b01e66' }}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
