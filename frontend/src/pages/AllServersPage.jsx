import { useEffect, useState } from "react";
import { fetchServers } from "../api";
import PageHeader from "../components/PageHeader";
import ServerTable from "../components/ServerTable";

export default function AllServersPage() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchServers();
      setServers(data);
    } catch (err) {
      setError(err.message || "Unable to load servers");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <PageHeader
        eyebrow="Monitoring"
        title="Windows Server Manager"
        subtitle={
          <>
            Servers sourced from <code>prometheus.yml</code> — windows_exporter job
          </>
        }
      >
        <button className="btn btn-ghost" onClick={loadServers} disabled={loading}>
          Refresh
        </button>
      </PageHeader>

      <main className="main">
        {loading && (
          <div className="state-card">
            <div className="spinner" />
            <p>Loading servers…</p>
          </div>
        )}

        {!loading && error && (
          <div className="state-card state-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadServers}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && servers.length === 0 && (
          <div className="state-card">
            <p>No servers found in the windows_exporter job.</p>
          </div>
        )}

        {!loading && !error && servers.length > 0 && <ServerTable servers={servers} />}
      </main>
    </div>
  );
}
