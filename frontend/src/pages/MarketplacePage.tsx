/**
 * MarketplacePage.tsx – Process Marketplace: card-grid listing with status
 * filter chips, client-side search, and the admin toolbar (Add/Edit/Delete).
 * Dependencies: useMarketplace, useDeleteMarketplaceEntry, useMe, i18n.store,
 *               MarketplaceCard, MarketplaceAddModal, MarketplaceEditStatusModal, sonner
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMarketplace, useDeleteMarketplaceEntry } from '../hooks/useMarketplace';
import { useMe } from '../hooks/useMe';
import { useI18n } from '../stores/i18n.store';
import { getErrorMessage } from '../lib/getErrorMessage';
import { MarketplaceCard } from '../components/marketplace/MarketplaceCard';
import { MarketplaceAddModal } from '../components/modals/MarketplaceAddModal';
import { MarketplaceEditStatusModal } from '../components/modals/MarketplaceEditStatusModal';
import type { MarketplaceEntry } from '../api/marketplace.api';

type Filter = 'ALL' | 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';

function matchesQuery(entry: MarketplaceEntry, q: string): boolean {
  const haystack = [entry.name, entry.description ?? '', ...entry.topics, ...entry.requiredRoles]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function MarketplacePage() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: entries = [], isLoading } = useMarketplace();
  const deleteMut = useDeleteMarketplaceEntry();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<MarketplaceEntry | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceEntry | null>(null);
  const [deleteTotpCode, setDeleteTotpCode] = useState('');

  const isAdmin = !!me?.isAdmin;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== 'ALL' && e.status !== filter) return false;
      if (q && !matchesQuery(e, q)) return false;
      return true;
    });
  }, [entries, filter, search]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL', label: t('marketplaceFilterAll') },
    { key: 'APPROVED', label: t('marketplaceStatusApproved') },
    { key: 'EXPERIMENTAL', label: t('marketplaceStatusExperimental') },
    { key: 'DEPRECATED', label: t('marketplaceStatusDeprecated') },
  ];

  async function handleDelete() {
    if (!deleteTarget || deleteTotpCode.length !== 6) {
      toast.error(t('totpRequired'));
      return;
    }
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id, body: { totpCode: deleteTotpCode } });
      toast.success(t('marketplaceDelete'));
      setDeleteTarget(null);
      setDeleteTotpCode('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('genericActionFailed'));
      toast.error(msg);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        padding: '32px',
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '28px', color: 'var(--primary)' }}
        >
          hub
        </span>
        <div>
          <h1
            style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
          >
            {t('marketplaceTitle')}
          </h1>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0 20px' }} />

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('marketplaceSearchPlaceholder')}
        aria-label={t('marketplaceSearchPlaceholder')}
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '8px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          marginBottom: '16px',
        }}
      />

      {/* Filter chips + admin toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '5px 14px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: filter === f.key ? 'var(--primary)' : 'var(--border)',
              background: filter === f.key ? 'var(--primary)' : 'var(--bg-card)',
              color: filter === f.key ? '#fff' : 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: filter === f.key ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            style={{
              marginLeft: 'auto',
              padding: '7px 16px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              add
            </span>
            {t('marketplaceAdd')}
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading && <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('loading')}</p>}

      {!isLoading && filtered.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 32px',
            color: 'var(--text-muted)',
            fontSize: '14px',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '40px', display: 'block', marginBottom: '12px', opacity: 0.4 }}
          >
            deployed_code
          </span>
          {t('marketplaceEmpty')}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}
        >
          {filtered.map((entry) => (
            <div key={entry.id} style={{ position: 'relative' }}>
              <MarketplaceCard entry={entry} />
              {isAdmin && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '10px',
                    display: 'flex',
                    gap: '6px',
                  }}
                >
                  <button
                    aria-label={t('marketplaceEdit')}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditEntry(entry);
                    }}
                    style={adminBtn('var(--text-primary)')}
                  >
                    {t('marketplaceEdit')}
                  </button>
                  <button
                    aria-label={t('marketplaceDelete')}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(entry);
                      setDeleteTotpCode('');
                    }}
                    style={adminBtn('#b91c1c')}
                  >
                    {t('marketplaceDelete')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <MarketplaceAddModal open={addOpen} onClose={() => setAddOpen(false)} />

      {editEntry && (
        <MarketplaceEditStatusModal
          open={true}
          onClose={() => setEditEntry(null)}
          entryId={editEntry.id}
          currentStatus={editEntry.status}
          slug={editEntry.slug}
          entry={editEntry}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setDeleteTarget(null);
            setDeleteTotpCode('');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
            }}
          >
            <h2
              style={{
                margin: '0 0 4px',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {t('marketplaceConfirmDelete')}
            </h2>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {deleteTarget.name || deleteTarget.gitUrl}
            </p>
            <input
              value={deleteTotpCode}
              onChange={(e) => setDeleteTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: '180px',
                display: 'block',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                letterSpacing: '4px',
                textAlign: 'center',
                fontSize: '14px',
                background: 'var(--bg-page)',
                color: 'var(--text-primary)',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteTotpCode('');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMut.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#b91c1c',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  opacity: deleteMut.isPending ? 0.6 : 1,
                }}
              >
                {t('marketplaceDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function adminBtn(color: string): React.CSSProperties {
  return {
    padding: '3px 9px',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    borderRadius: '6px',
    fontSize: '11px',
    cursor: 'pointer',
    color,
  };
}
