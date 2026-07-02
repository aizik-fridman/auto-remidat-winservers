import { useState, useEffect, useCallback } from "react";
import PageHeader from "../components/PageHeader.jsx";
import ServerTable from "../components/ServerTable.jsx";
import { fetchServers } from "../api.js";

/**
 * AllServersPage — main dashboard showing all servers in a card grid.
 */
export default function AllServersPage() {
  const [servers, setServers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServers();
      setServers(data);
    } catch (err) {
      setError(err.message || "Failed to load servers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Monitoring Center"
        subtitle="Manage and monitor your Windows server fleet"
      >
        <button
          className="btn btn--ghost"
          onClick={load}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner spinner--sm" /> Refreshing…
            </>
          ) : (
            "↻ Refresh"
          )}
        </button>
      </PageHeader>

      <main className="page-wrapper">
        {loading && !servers && (
          <div className="loading-state">
            <div className="spinner" />
            <p className="loading-state__text">Loading servers…</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <div className="error-state__icon">⚠️</div>
            <p className="error-state__message">{error}</p>
            <button className="btn btn--primary" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && servers && <ServerTable servers={servers} />}
      </main>
    </>
  );
}
