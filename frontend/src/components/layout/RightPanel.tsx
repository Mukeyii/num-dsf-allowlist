/**
 * RightPanel.tsx – Right panel 280px
 */
import { useApprovalStatus, useApprovalHistory } from '../../hooks/useApproval';
import { useMemberships }   from '../../hooks/useMemberships';
import { useCertificates }  from '../../hooks/useCertificates';
import { useModals }        from '../../hooks/useModals';

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

export function RightPanel({ instanceId }: { instanceId: string | null }) {
  const { data: approval }          = useApprovalStatus(instanceId);
  const { data: history = [] }      = useApprovalHistory(instanceId);
  const { data: memberships = [] }  = useMemberships(instanceId);
  const { data: certificates = [] } = useCertificates(instanceId);

  return (
    <aside className="w-[280px] h-screen fixed right-0 top-0 bg-white border-l border-slate-100 flex flex-col p-6 gap-6 z-50">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Approval Status</h2>
        <p className="text-xs text-slate-500">Operational Overview</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              Current Status
            </span>
            {approval?.status === 'PENDING' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                1 PENDING
              </span>
            )}
            {approval?.status === 'APPROVED' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                APPROVED
              </span>
            )}
            {!approval && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                NO REQUEST
              </span>
            )}
          </div>
          {approval?.status === 'PENDING' && (
            <p className="text-xs text-amber-700">
              Awaiting verification for pending changes.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Overview</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-slate-50 rounded-xl text-center">
            <p className="text-lg font-bold text-primary">{certificates.length}</p>
            <p className="text-[10px] text-slate-500">Certificates</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-center">
            <p className="text-lg font-bold text-secondary">{memberships.length}</p>
            <p className="text-[10px] text-slate-500">Members</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Recent Activity
        </p>
        <div className="space-y-3">
          {history.slice(0, 5).map((req: any) => (
            <div key={req.id} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                req.status === 'APPROVED' ? 'bg-emerald-500' :
                req.status === 'PENDING'  ? 'bg-amber-500'   :
                req.status === 'REJECTED' ? 'bg-red-500'     : 'bg-slate-300'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold">Request #{req.id.slice(-4)}</p>
                <p className="text-[10px] text-slate-500">
                  {relativeTime(req.submitted_at || req.created_at)}
                </p>
              </div>
              <span className={`text-[10px] font-bold ${
                req.status === 'APPROVED' ? 'text-emerald-600' :
                req.status === 'PENDING'  ? 'text-amber-600'   :
                req.status === 'REJECTED' ? 'text-red-600'     : 'text-slate-400'
              }`}>
                {req.status}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-xs text-slate-400">No requests yet.</p>
          )}
        </div>
      </div>

      <button
        className="w-full py-3 px-6 rounded-xl text-white font-bold text-sm"
        style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}
        onClick={() => useModals.getState().openModal('approval')}
      >
        Send for Approval
      </button>
    </aside>
  );
}
