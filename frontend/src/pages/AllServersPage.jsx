import { useState, useEffect, useCallback, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredServers = useMemo(() => {
    if (!servers) return null;
    if (!searchQuery) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(s => 
      s.hostname?.toLowerCase().includes(q) || 
      s.ip?.toLowerCase().includes(q) || 
      s.system?.toLowerCase().includes(q) ||
      s.team?.toLowerCase().includes(q)
    );
  }, [servers, searchQuery]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Monitoring Center"
        subtitle="Manage and monitor your server fleet in real-time"
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
        <div style={{ marginBottom: 'var(--sp-6)', maxWidth: '400px' }}>
          <input 
            type="text" 
            className="input-field glass-panel" 
            style={{ width: '100%' }}
            placeholder="Search servers by hostname, IP, system..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

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

        {!loading && !error && filteredServers && <ServerTable servers={filteredServers} />}
      </main>
    </>
  );
}
