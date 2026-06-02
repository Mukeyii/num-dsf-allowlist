/**
 * DownloadModal.tsx — modal to download the FHIR allow-list bundle and the IP-address Excel list.
 * Gates downloads behind a disclaimer acknowledgment; exposes the bundle URL and a content preview.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { selectClass } from './FormField';
import { useEndpoints } from '../../hooks/useEndpoints';
import { api, downloadFullAllowListBundle } from '../../api/entities.api';
import { BundlePreview } from './BundlePreview';
import { useI18n } from '../../stores/i18n.store';

interface Props { open: boolean; onClose: () => void; instanceId: string; }

export function DownloadModal({ open, onClose, instanceId }: Props) {
  const { t } = useI18n();
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [downloading, setDownloading] = useState(false);
  // Acknowledgment gate: federated AllowList bundles are recommendations, not
  // automatically-trusted artefacts. Sites must verify content+signature+
  // provenance before deploying. Block downloads until the operator confirms.
  const [acknowledged, setAcknowledged] = useState(false);

  const bundleUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/download/full-bundle`;

  async function downloadBundle() {
    setDownloading(true);
    try {
      const res = await downloadFullAllowListBundle();
      const blob = new Blob([res.data], { type: 'application/fhir+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dsf-allow-list-bundle.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('bundleDownloaded'));
    } catch {
      toast.error(t('bundleDownloadFailed'));
    } finally {
      setDownloading(false);
    }
  }

  async function downloadIpList() {
    setDownloading(true);
    try {
      const res = await api(instanceId).downloadIpList();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `dsf-ip-address-list-${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t('downloadIpSuccess'));
    } catch { toast.error(t('downloadIpFailed')); }
    finally { setDownloading(false); }
  }

  function copyUrl() { navigator.clipboard.writeText(bundleUrl); toast.success(t('downloadCopied')); }

  return (
    <Modal open={open} onClose={onClose} title={t('downloadModalTitle')}>
      <div className="space-y-5">
        <div
          className="p-3 rounded-xl border"
          style={{ background: 'var(--bg-hover)', borderColor: 'var(--border)' }}
          data-testid="bundle-disclaimer"
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {t('bundleDisclaimerHeading')}
          </p>
          <p className="text-[11px] mb-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {t('bundleDisclaimerBody')}
          </p>
          <label className="flex items-start gap-2 text-[11px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
              data-testid="disclaimer-checkbox"
            />
            <span>{t('bundleDisclaimerAcknowledge')}</span>
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('downloadModalSelectEndpoint')}</label>
          <select value={selectedEndpoint} onChange={e => setSelectedEndpoint(e.target.value)} className={selectClass}>
            <option value="">{t('downloadModalSelectEndpointPlaceholder')}</option>
            {endpoints.map((ep: any) => (<option key={ep.identifier} value={ep.identifier}>{ep.name || ep.identifier}</option>))}
          </select>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">{t('downloadFullBundleTitle')}</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">{t('downloadFullBundleHelp')}</p>
          <div className="relative">
            <div className="font-mono text-[10px] text-primary bg-white border border-slate-200 rounded-lg p-3 pr-10 break-all leading-relaxed">{bundleUrl}</div>
            <button type="button" onClick={copyUrl} title={t('downloadModalCopyUrl')} className="absolute right-2 top-2 p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 italic">{t('downloadEndpointHint')}</p>
          <button type="button" disabled={downloading || !acknowledged} onClick={downloadBundle}
            data-testid="download-bundle-btn"
            className="w-full py-2 text-xs font-bold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #8a1750, #675df9)' }}>
            {downloading ? t('downloadModalDownloading') : t('downloadModalDownloadBundle')}
          </button>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">{t('downloadModalIpTitle')}</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">{t('downloadModalIpDesc')}</p>
          <button type="button" onClick={downloadIpList} disabled={downloading || !acknowledged}
            data-testid="download-ip-btn"
            className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {downloading ? t('downloadModalDownloading') : t('downloadModalDownloadIp')}
          </button>
        </div>
        <BundlePreview instanceId={instanceId} />
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[11px] text-slate-500 m-0">
            {t('downloadModalPluginTip').split('DSF Allow List Plugin')[0]}
            <a href="https://github.com/datasharingframework/dsf-process-allow-list/releases" target="_blank" rel="noopener noreferrer" className="text-[#b01e66] no-underline hover:underline">DSF Allow List Plugin</a>
            {t('downloadModalPluginTip').split('DSF Allow List Plugin')[1]}
          </p>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">{t('downloadModalClose')}</button>
        </div>
      </div>
    </Modal>
  );
}
