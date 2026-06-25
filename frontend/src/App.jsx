import { useEffect, useState } from "react";
import AuthModal from "./AuthModal";
import ServerTable from "./ServerTable";

export default function App() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadServers();
  }, []);

  async function loadServers() {
    setLoading(true);
    setError("");
    try {
      const { fetchServers } = await import("../api");
      const data = await fetchServers();
      setServers(data);
    } catch (err) {
      setError(err.message || "Unable to load servers");
    } finally {
      setLoading(false);
    }
  }

  function openModal(server, action) {
    setModal({ server, action });
  }

  function closeModal() {
    setModal(null);
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <p className="eyebrow">Monitoring</p>
            <h1>Windows Server Manager</h1>
            <p className="subtitle">
              Servers sourced from <code>prometheus.yml</code> — windows_exporter job
            </p>
          </div>
          <button className="btn btn-ghost" onClick={loadServers} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

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

        {!loading && !error && servers.length > 0 && (
          <ServerTable servers={servers} onAction={openModal} />
        )}
      </main>

      {modal && (
        <AuthModal
          server={modal.server}
          action={modal.action}
          onClose={closeModal}
          onSuccess={showToast}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
