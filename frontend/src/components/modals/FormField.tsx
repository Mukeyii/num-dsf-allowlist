import React from 'react';

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

export function ModalFooter({ onCancel, onSubmit, submitLabel, loading }: {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
      <button type="button" onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
        Cancel
      </button>
      <button type={onSubmit ? 'button' : 'submit'} onClick={onSubmit} disabled={loading}
        className="px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        style={{ background: loading ? '#a0a0a0' : 'linear-gradient(135deg, #4d41df, #675df9)' }}>
        {loading ? 'Saving…' : (submitLabel || 'Save')}
      </button>
    </div>
  );
}
