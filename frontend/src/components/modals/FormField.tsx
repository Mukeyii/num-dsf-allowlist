import React from 'react';
import { useI18n } from '../../stores/i18n.store';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[10px] text-slate-400">{hint}</p>}
      {error && (
        <p className="text-[10px] text-red-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">error</span>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg ' +
  'text-slate-900 placeholder:text-slate-300 outline-none ' +
  'focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all';

export const selectClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg ' +
  'text-slate-900 outline-none focus:border-primary focus:ring-2 ' +
  'focus:ring-primary/10 transition-all';

export function ModalFooter({ onCancel, onSubmit, submitLabel, loading, disabled }: {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const isDisabled = loading || disabled;
  return (
    <div className="flex justify-end gap-3 pt-4 mt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <button type="button" onClick={onCancel}
        className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>
        {t('modalCancelBtn')}
      </button>
      <button type={onSubmit ? 'button' : 'submit'} onClick={onSubmit} disabled={isDisabled}
        className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        style={{ background: isDisabled ? '#a0a0a0' : 'linear-gradient(135deg, #4d41df, #675df9)' }}>
        {loading ? t('modalSavingBtn') : (submitLabel || t('modalSaveBtn'))}
      </button>
    </div>
  );
}
