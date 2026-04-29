/**
 * TopBar.tsx – Canvas top bar
 * Dependencies: SearchBar, NotificationCenter, theme.store, i18n.store
 */
import { useNavigate } from 'react-router-dom';
import { SearchBar } from './SearchBar';
import { NotificationCenter } from './NotificationCenter';
import { useI18n } from '../../stores/i18n.store';
import { useThemeStore } from '../../stores/theme.store';

const ENV = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';

export function TopBar({ onDownload, onApproval, showInstanceActions = false }: {
  onDownload: () => void;
  onApproval: () => void;
  showInstanceActions?: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const { dark, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 z-40" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
          title="Back"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <button
          onClick={() => navigate(1)}
          className="transition-colors"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
          title="Forward"
          aria-label="Go forward"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
        </button>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
          <span className="text-sm font-semibold text-slate-700">Allow List Management</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-primary font-medium">{ENV}-Environment</span>
        </div>
      </div>

      {showInstanceActions && <SearchBar />}

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button onClick={toggleTheme} aria-label="Toggle theme" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '8px' }} title={dark ? 'Light Mode' : 'Dark Mode'}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>
            {dark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Language toggle */}
        <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} aria-label="Toggle language" style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }} title={lang === 'en' ? 'Deutsch' : 'English'}>
          {lang.toUpperCase()}
        </button>

        <NotificationCenter />
        {showInstanceActions && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
