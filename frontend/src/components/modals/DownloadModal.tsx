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
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">Allow-list bundle</p>
          {bundleUrl ? (
            <div className="relative">
              <div className="font-mono text-[10px] text-primary bg-white border border-slate-200 rounded-lg p-3 pr-10 break-all leading-relaxed">{bundleUrl}</div>
              <button type="button" onClick={copyUrl} title="Copy URL" className="absolute right-2 top-2 p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
              </button>
            </div>
          ) : (<p className="text-[10px] text-slate-400 italic">Select an endpoint above.</p>)}
          <button type="button" disabled={!selectedEndpoint || downloading} onClick={downloadBundle}
            className="w-full py-2 text-xs font-bold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #8a1750, #675df9)' }}>
            {downloading ? 'Downloading…' : 'Download Bundle (JSON)'}
          </button>
        </div>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <p className="text-xs font-bold text-slate-700">IP Address List</p>
          <p className="text-[10px] text-slate-500 leading-relaxed">Contains all outgoing IP addresses of participating organizations. Use for firewall configuration.</p>
          <button type="button" onClick={downloadIpList} disabled={downloading}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40">
            {downloading ? 'Downloading…' : 'Download IP Address List (Excel)'}
          </button>
        </div>
        <BundlePreview instanceId={instanceId} />
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-[11px] text-slate-500 m-0">
            Tip: install the{' '}
            <a href="https://github.com/datasharingframework/dsf-process-allow-list/releases" target="_blank" rel="noopener noreferrer" className="text-[#b01e66] no-underline hover:underline">DSF Allow List Plugin</a>{' '}
            to update directly from your DSF FHIR Server Web UI.
          </p>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </Modal>
  );
}
