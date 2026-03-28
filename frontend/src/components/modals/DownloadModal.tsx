import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { selectClass } from './FormField';
import { useEndpoints } from '../../hooks/useEndpoints';
import { api } from '../../api/entities.api';
import { BundlePreview } from './BundlePreview';

interface Props { open: boolean; onClose: () => void; instanceId: string; }

export function DownloadModal({ open, onClose, instanceId }: Props) {
  const { data: endpoints = [] } = useEndpoints(instanceId);
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [variant, setVariant] = useState<'webui' | 'manual'>('webui');
  const [downloading, setDownloading] = useState(false);

  const bundleUrl = selectedEndpoint
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'}/instances/${instanceId}/download/bundle?endpointId=${selectedEndpoint}`
    : '';

  async function downloadBundle() {
    if (!selectedEndpoint) { toast.error('Please select an endpoint.'); return; }
    setDownloading(true);
    try {
      const res = await api(instanceId).downloadBundle(selectedEndpoint);
      const blob = new Blob([res.data], { type: 'application/fhir+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `allowlist-bundle-${selectedEndpoint}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Bundle downloaded.');
    } catch { toast.error('Failed to download bundle.'); }
    finally { setDownloading(false); }
  }

  async function downloadIpList() {
    setDownloading(true);
    try {
      const res = await api(instanceId).downloadIpList();
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `dsf-ip-address-list-${new Date().toISOString().split('T')[0]}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success('IP address list downloaded.');
    } catch { toast.error('Failed to download IP address list.'); }
    finally { setDownloading(false); }
  }

  function copyUrl() { navigator.clipboard.writeText(bundleUrl); toast.success('URL copied to clipboard.'); }

  return (
    <Modal open={open} onClose={onClose} title="Download Allow List">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Selected Endpoint</label>
          <select value={selectedEndpoint} onChange={e => setSelectedEndpoint(e.target.value)} className={selectClass}>
            <option value="">Select endpoint…</option>
            {endpoints.map((ep: any) => (<option key={ep.identifier} value={ep.identifier}>{ep.name || ep.identifier}</option>))}
          </select>
        </div>
        <div className="flex gap-2">
          {(['webui', 'manual'] as const).map(v => (
            <button key={v} type="button" onClick={() => setVariant(v)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${variant === v ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {v === 'webui' ? 'DSF Web UI' : 'Manually'}
            </button>
          ))}
        </div>
        {variant === 'webui' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-700">Variant 1: DSF Web UI (recommended)</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">Open your DSF FHIR server web UI and trigger the <code className="bg-slate-200 px-1 rounded text-[9px]">downloadAllowList</code> task with this URL:</p>
            {bundleUrl ? (
              <div className="relative">
                <div className="font-mono text-[10px] text-primary bg-white border border-slate-200 rounded-lg p-3 pr-10 break-all leading-relaxed">{bundleUrl}</div>
                <button type="button" onClick={copyUrl} className="absolute right-2 top-2 p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            ) : (<p className="text-[10px] text-slate-400 italic">Select an endpoint above.</p>)}
            <button type="button" disabled={!selectedEndpoint || downloading} onClick={downloadBundle}
              className="w-full py-2 text-xs font-bold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}>
              {downloading ? 'Downloading…' : 'Download Bundle (JSON)'}
            </button>
          </div>
        )}
        {variant === 'manual' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-700">Variant 2: Manually</p>
            <p className="text-[10px] text-slate-500">Use the API URL directly to fetch the bundle:</p>
            {bundleUrl ? (<div className="font-mono text-[10px] text-primary bg-white border border-slate-200 rounded-lg p-3 break-all">GET {bundleUrl}</div>)
            : (<p className="text-[10px] text-slate-400 italic">Select an endpoint above.</p>)}
          </div>
        )}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">IP Address List</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">Contains all outgoing IP addresses of participating organizations. Use for firewall configuration.</p>
          <button type="button" onClick={downloadIpList} disabled={downloading}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40">
            {downloading ? 'Downloading…' : 'Download IP Address List (Excel)'}
          </button>
        </div>
        <BundlePreview instanceId={instanceId} />
        {/* DSF Web UI Integration */}
        <div className="pt-5 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#6c63ff]">integration_instructions</span>
            <h3 className="text-sm font-bold text-slate-700 m-0">DSF Web UI Integration</h3>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[11px] text-slate-500 mb-2">
              If you have the <strong>DSF Allow List Plugin</strong> installed, you can update directly via your DSF FHIR Server Web UI.
            </p>
            <a
              href="https://github.com/datasharingframework/dsf-process-allow-list/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#6c63ff] no-underline hover:underline"
            >
              Download plugin →
            </a>
          </div>
          {endpoints.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No endpoints configured yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {endpoints.map((ep: any) => {
                const fhirTaskUrl = `https://${ep.identifier}/fhir/Task?identifier=http://dsf.dev/sid/task-identifier|http://dsf.dev/bpe/Process/downloadAllowList/1.0/task-download-allow-list&status=draft`;
                const epBundleUrl = `${window.location.origin}/api/v1/instances/${instanceId}/download/bundle?endpointId=${ep.identifier}`;
                return (
                  <div key={ep.identifier} className="p-3 border border-slate-200 rounded-xl bg-white space-y-2">
                    <p className="text-xs font-semibold text-slate-700 m-0">{ep.name || ep.identifier}</p>
                    <div className="text-[11px] text-slate-500 space-y-2">
                      <p className="m-0">1. Open your DSF FHIR Server:</p>
                      <a
                        href={fhirTaskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-mono text-[10px] text-[#6c63ff] break-all px-2 py-1.5 bg-slate-50 rounded-md no-underline hover:underline"
                      >
                        {fhirTaskUrl}
                      </a>
                      <p className="m-0">2. Click the download task and enter this Bundle URL:</p>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 font-mono text-[10px] text-[#6c63ff] break-all px-2 py-1.5 bg-slate-50 rounded-md block">
                          {epBundleUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(epBundleUrl); toast.success('Bundle URL copied.'); }}
                          title="Copy Bundle URL"
                          className="p-1 border-none bg-transparent cursor-pointer flex-shrink-0 hover:bg-slate-100 rounded transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-slate-400">content_copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </Modal>
  );
}
