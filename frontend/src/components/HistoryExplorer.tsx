import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
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
  onDeleteAll?: () => Promise<void> | void;
  deletingAll?: boolean;
  snapshotControls?: ReactNode;
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
  onDeleteAll,
  deletingAll = false,
  snapshotControls,
}: HistoryExplorerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purgeConfirmVisible, setPurgeConfirmVisible] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const emptyState = useMemo(() => {
    return items.length === 0 && !loading;
  }, [items, loading]);

  const hasLockedEntries = useMemo(
    () => items.some((item) => item.forkInfo?.status === "in-progress"),
    [items]
  );

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

  const handleDeleteAllIntent = useCallback(() => {
    if (!onDeleteAll || deletingAll || items.length === 0) {
      return;
    }
    setPurgeConfirmVisible(true);
    setPurgeError(null);
  }, [deletingAll, items.length, onDeleteAll]);

  const handleCancelPurge = useCallback(() => {
    if (deletingAll) {
      return;
    }
    setPurgeConfirmVisible(false);
    setPurgeError(null);
  }, [deletingAll]);

  const handleConfirmPurge = useCallback(async () => {
    if (!onDeleteAll || deletingAll) {
      return;
    }
    try {
      await onDeleteAll();
      setPurgeConfirmVisible(false);
      setPurgeError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPurgeError(message);
    }
  }, [deletingAll, onDeleteAll]);

  useEffect(() => {
    if (items.length === 0) {
      setPurgeConfirmVisible(false);
      setPurgeError(null);
    }
  }, [items.length]);

  const purgeConfirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (purgeConfirmVisible && purgeConfirmRef.current) {
      purgeConfirmRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [purgeConfirmVisible]);

  const purgeDisabled =
    !onDeleteAll || items.length === 0 || deletingAll || loading || hasLockedEntries;
  const purgeButtonLabel = deletingAll
    ? "Purging…"
    : hasLockedEntries
      ? "Locked by A/B test"
      : "Delete all";

  return (
    <section className="admin-card">
      <div className="admin-card__header history-header">
        <div>
          <h2>History</h2>
          <p className="admin-card__subtitle">
            {`Tracked ${totalCount} entries across ${sessionCount} session${sessionCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="history-toolbar">
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
            {onDeleteAll ? (
              <button
                type="button"
                className="admin-secondary admin-secondary--danger history-delete-all-button"
                onClick={handleDeleteAllIntent}
                disabled={purgeDisabled}
                title={
                  hasLockedEntries
                    ? "Resolve the active A/B comparison to delete all history"
                    : undefined
                }
              >
                {purgeButtonLabel}
              </button>
            ) : null}
          </div>
          {statusMessage || autoStatus ? (
            <div className="history-toolbar__meta">
              {statusMessage ? (
                <span className="history-status history-status--info">{statusMessage}</span>
              ) : null}
              {autoStatus ? (
                <span className="history-status history-status--muted">{autoStatus}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {purgeConfirmVisible ? (
        <div
          ref={purgeConfirmRef}
          className="history-purge-banner"
          role="alert"
        >
          <div className="history-purge-banner__body">
            <strong>Delete all history?</strong>
            <p>
              This removes every generated page, REST call, and attachment snapshot. The current session will
              start fresh.
            </p>
            {purgeError ? (
              <p className="history-purge-banner__error" role="alert">
                {purgeError}
              </p>
            ) : null}
          </div>
          <div className="history-purge-banner__actions">
            <button
              type="button"
              className="admin-secondary admin-secondary--link"
              onClick={handleCancelPurge}
              disabled={deletingAll}
            >
              Keep history
            </button>
            <button
              type="button"
              className="admin-danger"
              onClick={handleConfirmPurge}
              disabled={deletingAll}
            >
              {deletingAll ? "Purging…" : "Yes, delete everything"}
            </button>
          </div>
        </div>
      ) : null}
      {snapshotControls}

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
                  <span className="history-chip" aria-label="Duration">
                    ⏱ {formatDuration(item.durationMs)}
                  </span>
                  {item.entryKind !== "html" ? (
                    <span className="history-chip history-chip--muted">
                      {item.entryKind === "rest-mutation" ? "REST mutation" : "REST query"}
                    </span>
                  ) : null}
                  {item.forkInfo ? (
                    <span
                      className={`history-chip history-chip--fork history-chip--fork-${item.forkInfo.status}`}
                      aria-label={`Fork status: ${item.forkInfo.status}`}
                    >
                      {`Variant ${item.forkInfo.label}`}
                      {item.forkInfo.status === "in-progress"
                        ? " · in review"
                        : item.forkInfo.status === "chosen"
                          ? " · kept"
                          : " · discarded"}
                    </span>
                  ) : null}
                  {item.usageSummary ? (
                    <span className="history-chip history-chip--accent">{item.usageSummary}</span>
                  ) : null}
                  <span className="history-chip history-chip--muted" aria-label="Created at">
                    {dateTimeFormatter.format(new Date(item.createdAt))}
                  </span>
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
                  {item.entryKind === "html" ? (
                    <div className="history-item__stat">
                      <div className="history-item__label">Usage</div>
                      <div className="history-item__value">{item.usageSummary || "—"}</div>
                    </div>
                  ) : null}
                </div>
                {item.entryKind !== "html" && item.rest ? (
                  <div className="history-item__section">
                    <div className="history-item__label">REST payload</div>
                    <div className="history-item__rest">
                      <div className="history-item__value">Request:</div>
                      <pre className="history-item__json">
                        {JSON.stringify(
                          {
                            method: item.rest.request.method,
                            path: item.rest.request.path,
                            query: item.rest.request.query,
                            body: item.rest.request.body,
                          },
                          null,
                          2
                        )}
                      </pre>
                      {item.rest.responseSummary ? (
                        <>
                          <div className="history-item__value">Response:</div>
                          <pre className="history-item__json">{item.rest.responseSummary}</pre>
                        </>
                      ) : null}
                      {item.rest.error ? (
                        <div className="history-item__value history-item__value--error">
                          Error: {item.rest.error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {item.entryKind === "html" && (item.restMutations?.length || item.restQueries?.length) ? (
                  <div className="history-item__section">
                    <div className="history-item__label">Captured REST activity</div>
                    <div className="history-item__rest-group">
                      {item.restMutations?.length ? (
                        <div className="history-item__rest-collection">
                          <div className="history-item__rest-heading">
                            {item.restMutations.length === 1
                              ? "1 mutation"
                              : `${item.restMutations.length} mutations`}
                          </div>
                          <div className="history-item__rest-list">
                            {item.restMutations.map((mutation) => (
                              <div key={mutation.id} className="history-item__rest-entry">
                                <div className="history-item__rest-header">
                                  <span className="history-item__method-chip" aria-label={`${mutation.method} request`}>
                                    {mutation.method}
                                  </span>
                                  <span className="history-item__rest-path">{mutation.path}</span>
                                  <span className="history-chip history-chip--muted">
                                    {dateTimeFormatter.format(new Date(mutation.createdAt))}
                                  </span>
                                </div>
                                <div className="history-item__rest-details">
                                  <div>
                                    <div className="history-item__label">Query</div>
                                    <div className="history-item__value">{mutation.querySummary || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="history-item__label">Body</div>
                                    <div className="history-item__value">{mutation.bodySummary || "—"}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {item.restQueries?.length ? (
                        <div className="history-item__rest-collection">
                          <div className="history-item__rest-heading">
                            {item.restQueries.length === 1
                              ? "1 query"
                              : `${item.restQueries.length} queries`}
                          </div>
                          <div className="history-item__rest-list">
                            {item.restQueries.map((query) => (
                              <div key={query.id} className="history-item__rest-entry">
                                <div className="history-item__rest-header">
                                  <span className="history-item__method-chip" aria-label={`${query.method} request`}>
                                    {query.method}
                                  </span>
                                  <span className="history-item__rest-path">{query.path}</span>
                                  <span className="history-chip history-chip--muted">
                                    {dateTimeFormatter.format(new Date(query.createdAt))}
                                  </span>
                                  {typeof query.ok === "boolean" ? (
                                    <span className={`history-chip${query.ok ? "" : " history-chip--error"}`}>
                                      {query.ok ? "Response OK" : "Response error"}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="history-item__rest-details">
                                  <div>
                                    <div className="history-item__label">Query</div>
                                    <div className="history-item__value">{query.querySummary || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="history-item__label">Body</div>
                                    <div className="history-item__value">{query.bodySummary || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="history-item__label">Response</div>
                                    <div className="history-item__value">{query.responseSummary || "—"}</div>
                                  </div>
                                  {query.error ? (
                                    <div className="history-item__value history-item__value--error">
                                      Error: {query.error}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
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
                      {item.reasoningDetails.length === 1 ? (
                        <div className="history-item__reasoning-inline">
                          <ReactMarkdown remarkPlugins={markdownPlugins}>
                            {item.reasoningDetails[0]}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        item.reasoningDetails.map((detail, idx) => (
                          <details
                            key={idx}
                            className="history-item__reasoning-detail"
                          >
                            <summary>{`Step ${idx + 1}`}</summary>
                            <ReactMarkdown remarkPlugins={markdownPlugins}>
                              {detail}
                            </ReactMarkdown>
                          </details>
                        ))
                      )}
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
                {item.generatedImages && item.generatedImages.length > 0 && (
                  <div className="history-item__section">
                    <details className="history-item__images">
                      <summary>
                        <div className="history-item__label">Generated images</div>
                        <span className="history-chip history-chip--muted">
                          {item.generatedImages.length === 1
                            ? "1 image"
                            : `${item.generatedImages.length} images`}
                        </span>
                      </summary>
                      <div className="history-item__image-grid">
                        {item.generatedImages.map((image) => (
                          <figure
                            key={image.id}
                            className="history-item__image-card"
                          >
                            <div className="history-item__image-thumb">
                              <img
                                src={image.url}
                                alt={image.prompt || "Generated image"}
                                loading="lazy"
                              />
                            </div>
                            <figcaption>
                              <div className="history-item__image-meta">
                                {`${image.ratio} · ${image.provider}`}
                              </div>
                              <div
                                className="history-item__image-prompt"
                                title={image.prompt}
                              >
                                {image.prompt || "(prompt unavailable)"}
                              </div>
                              <div className="history-item__image-actions">
                                <a
                                  href={image.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="admin-secondary admin-secondary--link"
                                >
                                  View
                                </a>
                                <a
                                  href={image.downloadUrl}
                                  download
                                  className="admin-secondary admin-secondary--link"
                                >
                                  Download
                                </a>
                              </div>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
                <div
                  className="history-item__actions"
                  role="group"
                  aria-label="History entry actions"
                >
                  <a
                    href={item.viewUrl}
                    target="_blank"
                    rel="noopener"
                    className="history-item__action admin-secondary admin-secondary--link"
                  >
                    Open page
                  </a>
                  <a
                    href={item.downloadUrl}
                    download
                    className="history-item__action admin-secondary admin-secondary--link"
                  >
                    Download HTML
                  </a>
                  {onDeleteEntry ? (
                    <button
                      type="button"
                      className="history-item__action history-item__action--danger admin-secondary admin-secondary--danger"
                      onClick={(event) => handleDelete(item.id, event)}
                      disabled={
                        deletingId === item.id || item.forkInfo?.status === "in-progress"
                      }
                      title={
                        item.forkInfo?.status === "in-progress"
                          ? "Finish the A/B comparison before deleting this entry"
                          : undefined
                      }
                    >
                      {deletingId === item.id
                        ? "Deleting…"
                        : item.forkInfo?.status === "in-progress"
                          ? "Locked by A/B test"
                          : "Delete entry"}
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
