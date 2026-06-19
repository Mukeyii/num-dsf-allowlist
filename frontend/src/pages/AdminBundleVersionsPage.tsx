/**
 * AdminBundleVersionsPage.tsx – Admin bundle-version history with download
 * + diff. Two version pickers (A / B); the diff card appears once both are
 * selected.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bundleVersionsApi, type BundleVersionListRow } from '../api/bundleVersions.api';
import { useI18n } from '../stores/i18n.store';

export function AdminBundleVersionsPage() {
  const { t } = useI18n();
  const [selA, setSelA] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['bundle-versions'],
    queryFn: () => bundleVersionsApi.list().then((r) => r.data),
  });

  const diff = useQuery({
    queryKey: ['bundle-versions-diff', selA, selB],
    queryFn: () => bundleVersionsApi.diff(selA!, selB!).then((r) => r.data.data),
    enabled: !!selA && !!selB && selA !== selB,
  });

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid="admin-bundle-versions">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {t('bundleVersionsTitle')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {t('bundleVersionsIntro')}
      </p>

      {list.isLoading ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('loading')}
        </p>
      ) : (list.data?.data?.length ?? 0) === 0 ? (
        <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
          {t('bundleVersionsEmpty')}
        </p>
      ) : (
        <table className="w-full text-sm mb-8">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left py-2 px-2 font-semibold">{t('bundleVersionsColVersion')}</th>
              <th className="text-left py-2 px-2 font-semibold">{t('createdAt')}</th>
              <th className="text-left py-2 px-2 font-semibold">{t('triggeredBy')}</th>
              <th className="text-left py-2 px-2 font-semibold">{t('triggeredByEmail')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.data!.data.map((r: BundleVersionListRow) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-2 font-mono">v{r.version_number}</td>
                <td className="py-2 px-2 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 px-2 text-xs">{r.triggered_by}</td>
                <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {r.triggered_by_email}
                </td>
                <td className="py-2 px-2 text-right space-x-2 whitespace-nowrap">
                  <a
                    href={bundleVersionsApi.downloadUrl(r.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold underline"
                    style={{ color: '#b01e66' }}
                  >
                    {t('download')}
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelA(r.id)}
                    className="text-xs font-semibold underline"
                    style={{ color: selA === r.id ? '#b01e66' : 'var(--text-secondary)' }}
                  >
                    {t('diffPickA')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelB(r.id)}
                    className="text-xs font-semibold underline"
                    style={{ color: selB === r.id ? '#b01e66' : 'var(--text-secondary)' }}
                  >
                    {t('diffPickB')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selA && selB && selA !== selB && (
        <section
          className="p-4 rounded-xl border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          data-testid="bundle-versions-diff"
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('diff')}
          </h2>
          {diff.isLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('loading')}
            </p>
          ) : diff.data ? (
            <>
              <p className="text-sm">
                <strong>{t('added')}:</strong> {diff.data.added.length}
              </p>
              <p className="text-sm">
                <strong>{t('removed')}:</strong> {diff.data.removed.length}
              </p>
              <p className="text-sm">
                <strong>{t('changed')}:</strong> {diff.data.changed.length}
              </p>
              <details className="mt-3">
                <summary className="text-xs cursor-pointer">{t('details')}</summary>
                <pre
                  className="text-[10px] mt-2 p-2 rounded overflow-auto"
                  style={{ background: 'var(--bg-page)' }}
                >
                  {JSON.stringify(diff.data, null, 2)}
                </pre>
              </details>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
