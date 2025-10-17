import { useCallback, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AdminHistoryItem } from "../api/types";

interface HistoryExplorerProps {
  items: AdminHistoryItem[];
  totalCount: number;
  sessionCount: number;
  loading: boolean;
  loadingMore: boolean;
  statusMessage?: string | null;
  autoRefreshEnabled: boolean;
  autoStatus?: string | null;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  onLoadMore?: () => void;
  hasMore: boolean;
  onDeleteEntry?: (id: string) => Promise<void> | void;
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const markdownPlugins = [remarkGfm];

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function HistoryExplorer({
  items,
  totalCount,
  sessionCount,
  loading,
  loadingMore,
  statusMessage,
  autoRefreshEnabled,
  autoStatus,
  onRefresh,
  onToggleAutoRefresh,
  onLoadMore,
  hasMore,
  onDeleteEntry,
}: HistoryExplorerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emptyState = useMemo(() => {
    return items.length === 0 && !loading;
  }, [items, loading]);

  const handleDelete = useCallback(
    async (entryId: string, event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!onDeleteEntry) return;
      setDeletingId(entryId);
      try {
        await onDeleteEntry(entryId);
      } catch (error) {
        console.error("Failed to delete history entry", error);
      } finally {
        setDeletingId((current) => (current === entryId ? null : current));
      }
    },
    [onDeleteEntry]
  );

  return (
    <section className="admin-card">
      <div className="admin-card__header">
        <div>
          <h2>History</h2>
          <p className="admin-card__subtitle">
            {`Tracked ${totalCount} entries across ${sessionCount} session${sessionCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="history-status-group">
          <button
            type="button"
            className="admin-secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className={`admin-secondary history-auto-toggle${autoRefreshEnabled ? " history-auto-toggle--active" : ""}`}
            onClick={onToggleAutoRefresh}
          >
            {autoRefreshEnabled ? "Auto-refresh: on" : "Auto-refresh: off"}
          </button>
          {statusMessage ? (
            <span className="history-status history-status--info">{statusMessage}</span>
          ) : null}
        </div>
        {autoStatus ? (
          <span className="history-status history-status--muted">{autoStatus}</span>
        ) : null}
      </div>

      {emptyState ? (
        <p className="history-empty">No history yet. Generate an experience to see it documented here.</p>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <details
              key={item.id}
              className="history-item"
            >
              <summary className="history-item__title">
                <span className="history-item__method-chip" aria-label={`${item.method} request`}>
                  {item.method}
                </span>
                <span className="history-item__path">{item.path}</span>
                <div className="history-item__chips">
                  <span className="history-chip" aria-label="Created at">
                    {dateTimeFormatter.format(new Date(item.createdAt))}
                  </span>
                  <span className="history-chip" aria-label="Duration">
                    ⏱ {formatDuration(item.durationMs)}
                  </span>
                  {item.usageSummary ? (
                    <span className="history-chip history-chip--accent">{item.usageSummary}</span>
                  ) : null}
                </div>
              </summary>
              <div className="history-item__content">
                {item.instructions ? (
                  <p className="history-item__instructions">{item.instructions}</p>
                ) : null}
                <div className="history-item__stats">
                  <div className="history-item__stat">
                    <div className="history-item__label">Query</div>
                    <div className="history-item__value">{item.querySummary || "—"}</div>
                  </div>
                  <div className="history-item__stat">
                    <div className="history-item__label">Body</div>
                    <div className="history-item__value">{item.bodySummary || "—"}</div>
                  </div>
                  <div className="history-item__stat">
                    <div className="history-item__label">Usage</div>
                    <div className="history-item__value">{item.usageSummary || "—"}</div>
                  </div>
                </div>
                {item.reasoningSummaries && item.reasoningSummaries.length > 0 && (
                  <div className="history-item__section">
                    <div className="history-item__label">Reasoning</div>
                    <ul className="history-item__list history-item__list--markdown">
                      {item.reasoningSummaries.map((entry, idx) => (
                        <li key={idx} className="history-item__list-item">
                          <ReactMarkdown remarkPlugins={markdownPlugins}>
                            {entry}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {item.reasoningDetails && item.reasoningDetails.length > 0 && (
                  <div className="history-item__section">
                    <div className="history-item__label">Reasoning details</div>
                    <div className="history-item__reasoning-details">
                      {item.reasoningDetails.map((detail, idx) => (
                        <details
                          key={idx}
                          className="history-item__reasoning-detail"
                        >
                          <summary>{`Step ${idx + 1}`}</summary>
                          <ReactMarkdown remarkPlugins={markdownPlugins}>
                            {detail}
                          </ReactMarkdown>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                {item.attachments && item.attachments.length > 0 && (
                  <div className="history-item__section">
                    <div className="history-item__label">Attachments</div>
                    <div className="history-item__attachments">
                      {item.attachments.map((attachment) => (
                        <figure key={attachment.id}>
                          {attachment.isImage ? (
                            <img src={attachment.dataUrl} alt={attachment.name} loading="lazy" />
                          ) : (
                            <div className="history-item__attachment-fallback" aria-hidden="true">📄</div>
                          )}
                          <figcaption>{`${attachment.name} · ${Math.round(attachment.size / 1024)} KB`}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                <div className="history-item__actions">
                  <a href={item.viewUrl} target="_blank" rel="noopener">Open page</a>
                  <a href={item.downloadUrl} download>
                    Download HTML
                  </a>
                  {onDeleteEntry ? (
                    <button
                      type="button"
                      className="history-item__delete-button"
                      onClick={(event) => handleDelete(item.id, event)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? "Deleting…" : "Delete entry"}
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {hasMore ? (
        <button
          type="button"
          className="admin-secondary history-load-more"
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}

export default HistoryExplorer;
