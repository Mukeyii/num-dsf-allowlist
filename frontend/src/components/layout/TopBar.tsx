/**
 * TopBar.tsx – Canvas top bar
 * Dependencies: SearchBar, NotificationCenter
 */
import { useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { NotificationCenter } from './NotificationCenter';
import { useI18n } from '../../stores/i18n.store';

const ENV = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';

export function TopBar({ onDownload, onApproval }: {
  onDownload: () => void;
  onApproval: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
          title="Back"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <button
          onClick={() => navigate(1)}
          className="transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
          title="Forward"
        >
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
        <NotificationCenter />
        <button
          onClick={onDownload}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          {t('downloadAllowList')}
        </button>
        <button
          onClick={onApproval}
          className="px-5 py-2 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: 'linear-gradient(135deg, #4d41df, #675df9)' }}
        >
          {t('sendForApproval')}
        </button>
      </div>
    </div>
  );
}
