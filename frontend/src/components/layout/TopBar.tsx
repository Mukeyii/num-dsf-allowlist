/**
 * TopBar.tsx – Canvas top bar
 * Dependencies: SearchBar
 */
import { SearchBar } from './SearchBar';

const ENV = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';

export function TopBar({ onDownload, onApproval }: {
  onDownload: () => void;
  onApproval: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 flex-shrink-0 z-40">
      <div className="flex items-center gap-3">
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
          <span className="text-sm font-semibold text-slate-700">Allow List Management</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-primary font-medium">{ENV}-Environment</span>
        </div>
      </div>

      <SearchBar />

      <div className="flex items-center gap-3">
        <button
          onClick={onDownload}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          Download Allow List
        </button>
        <button
          onClick={onApproval}
          className="px-5 py-2 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}
        >
          Send for Approval
        </button>
      </div>
    </div>
  );
}
