/** InfoHint.tsx - small accessible "?" trigger that reveals a short glossary explanation. */
import { useId, useState } from 'react';

interface InfoHintProps {
  text: string;
  label?: string;
}

export function InfoHint({ text, label = 'More information' }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="ml-1 w-3.5 h-3.5 inline-flex items-center justify-center rounded-full bg-[#6c63ff] text-white text-[9px] font-bold leading-none cursor-help"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute z-50 top-5 left-0 w-56 bg-slate-800 text-white text-[11px] leading-snug rounded-lg p-2 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
