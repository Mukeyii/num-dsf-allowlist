/**
 * EntityCard.tsx – Shared wrapper, styled per Stitch code.html
 */
import React from 'react';
import { useCanvasStore } from '../../stores/canvas.store';

interface EntityCardProps {
  id: string;
  title: string;
  borderColor: string;
  icon: string;
  iconColor?: string;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}

export function EntityCard({
  id, title, borderColor, icon, iconColor, badge,
  headerRight, onAdd, addLabel = '+ Add', children,
}: EntityCardProps) {
  const highlightedEntity = useCanvasStore((s) => s.highlightedEntity);
  const isHighlighted = highlightedEntity === id;

  return (
    <div
      id={`card-${id}`}
      className="rounded-[16px] p-6 entity-card-shadow group transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--bg-card)',
        borderLeft: `4px solid ${borderColor}`,
        outline: isHighlighted ? `2px solid ${borderColor}66` : 'none',
        outlineOffset: '2px',
        transition: 'outline 0.3s ease, transform 0.3s ease',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ color: iconColor || borderColor }}
            >
              {icon}
            </span>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
            {badge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {onAdd && (
            <button
              onClick={onAdd}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              {addLabel}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
