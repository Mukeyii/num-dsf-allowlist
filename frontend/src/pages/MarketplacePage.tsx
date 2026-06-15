/**
 * MarketplacePage.tsx – Process Marketplace listing with filter chips + admin toolbar
 * Dependencies: useMarketplace, useDeleteMarketplaceEntry, useMe, i18n.store,
 *               MarketplaceAddModal, MarketplaceEditStatusModal, sonner
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useMarketplace, useDeleteMarketplaceEntry } from '../hooks/useMarketplace';
import { useMe } from '../hooks/useMe';
import { useI18n } from '../stores/i18n.store';
import { getErrorMessage } from '../lib/getErrorMessage';
import { relTime } from '../lib/dateUtils';
import { MarketplaceAddModal } from '../components/modals/MarketplaceAddModal';
import { MarketplaceEditStatusModal } from '../components/modals/MarketplaceEditStatusModal';
import type { MarketplaceEntry } from '../api/marketplace.api';

type Filter = 'ALL' | 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';
type Status = 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';

const STATUS_PILL: Record<Status, { bg: string; fg: string }> = {
  APPROVED: { bg: '#dfffe7', fg: '#106a3b' },
  EXPERIMENTAL: { bg: '#fff4d6', fg: '#8a5b00' },
  DEPRECATED: { bg: '#e9ecef', fg: '#495057' },
};

export function MarketplacePage() {
  const { t } = useI18n();
  const { data: me } = useMe();
  const { data: entries = [], isLoading } = useMarketplace();
  const deleteMut = useDeleteMarketplaceEntry();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<{ id: string; status: Status } | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceEntry | null>(null);
  const [deleteTotpCode, setDeleteTotpCode] = useState('');

  const isAdmin = !!me?.isAdmin;

  const filtered = filter === 'ALL' ? entries : entries.filter((e) => e.status === filter);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL', label: t('marketplaceFilterAll') },
    { key: 'APPROVED', label: t('marketplaceStatusApproved') },
    { key: 'EXPERIMENTAL', label: t('marketplaceStatusExperimental') },
    { key: 'DEPRECATED', label: t('marketplaceStatusDeprecated') },
  ];

  async function handleDelete() {
    if (!deleteTarget || deleteTotpCode.length !== 6) {
      toast.error('6-digit TOTP code required');
      return;
    }
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id, body: { totpCode: deleteTotpCode } });
      toast.success(t('marketplaceDelete'));
      setDeleteTarget(null);
      setDeleteTotpCode('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Failed');
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
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#b01e66' }}>
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
              borderColor: filter === f.key ? '#b01e66' : 'var(--border)',
              background: filter === f.key ? '#b01e66' : 'var(--bg-card)',
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
              background: '#b01e66',
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

      {/* List */}
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
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {filtered.map((entry, idx) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isLast={idx === filtered.length - 1}
              isAdmin={isAdmin}
              onEditStatus={() => setEditEntry({ id: entry.id, status: entry.status })}
              onDelete={() => {
                setDeleteTarget(entry);
                setDeleteTotpCode('');
              }}
            />
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

function EntryRow({
  entry,
  isLast,
  isAdmin,
  onEditStatus,
  onDelete,
}: {
  entry: MarketplaceEntry;
  isLast: boolean;
  isAdmin: boolean;
  onEditStatus: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const pill = STATUS_PILL[entry.status];

  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 18px',
      }}
    >
      {/* Main link area */}
      <a
        href={entry.gitUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: 1,
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {entry.name || entry.gitUrl}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
              background: pill.bg,
              color: pill.fg,
            }}
          >
            {entry.status}
          </span>
          {entry.archived && (
            <span
              style={{
                fontSize: '10px',
                background: '#fde7e7',
                color: '#a01919',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '6px',
                fontWeight: 600,
              }}
            >
              Archived
            </span>
          )}
        </div>

        {entry.description && (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.description}
          </p>
        )}

        {entry.topics.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {entry.topics.slice(0, 6).map((topic) => (
              <span
                key={topic}
                style={{
                  fontSize: '10px',
                  background: '#eef0f4',
                  color: '#5d6470',
                  padding: '2px 6px',
                  borderRadius: '10px',
                }}
              >
                {topic}
              </span>
            ))}
            {entry.topics.length > 6 && (
              <span style={{ fontSize: '10px', color: '#6c757d' }}>
                +{entry.topics.length - 6} more
              </span>
            )}
          </div>
        )}

        <div
          style={{
            fontSize: '10px',
            color: '#6c757d',
            marginTop: '6px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          {entry.language && <span>{entry.language}</span>}
          {entry.latestReleaseTag && <span>· {entry.latestReleaseTag}</span>}
          <span>· ★ {entry.stars}</span>
          <span>· ⑂ {entry.forks}</span>
          <span>· ⓘ {entry.openIssues}</span>
          {entry.license && <span>· {entry.license}</span>}
          {entry.syncAt && !entry.syncError && (
            <span>· {t('marketplaceSyncedAgo').replace('{ago}', relTime(entry.syncAt, t))}</span>
          )}
          {entry.lastCommitAt && (
            <span>
              · {t('marketplaceLastUpdated').replace('{ago}', relTime(entry.lastCommitAt, t))}
            </span>
          )}
          {entry.syncError && (
            <span style={{ color: '#ef4444' }}>{t('marketplaceSyncFailed')}</span>
          )}
        </div>
      </a>

      {/* Homepage link + Admin action buttons */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
        {entry.homepage && (
          <a
            href={entry.homepage}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '10px',
              color: '#6c63ff',
              marginLeft: '8px',
              textDecoration: 'none',
            }}
            title={entry.homepage}
          >
            ↗ docs
          </a>
        )}
        {isAdmin && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditStatus();
              }}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              {t('marketplaceEdit')}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                color: '#b91c1c',
              }}
            >
              {t('marketplaceDelete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
