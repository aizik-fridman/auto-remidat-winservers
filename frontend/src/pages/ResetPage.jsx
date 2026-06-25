import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchServer, resetServer } from "../api";
import { BackLink } from "../components/PageHeader";
import PageHeader from "../components/PageHeader";

function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ResetPage() {
  const { hostname } = useParams();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadServer();
  }, [hostname]);

  async function loadServer() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchServer(hostname);
      setServer(data);
    } catch (err) {
      setError(err.message || "Server not found");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const data = await resetServer(hostname, password);
      setResult(data);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  }

  const isSuccess = result?.status === "success";

  return (
    <div className="app">
      <PageHeader
        eyebrow="Reset Server"
        title={hostname}
        subtitle={
          server ? (
            <>
              {server.ip}
              {server.port ? `:${server.port}` : ""} · {server.system} · {server.team}
            </>
          ) : (
            "Loading server details…"
          )
        }
      >
        <BackLink />
      </PageHeader>

      <main className="main main-narrow">
        {loading && (
          <div className="state-card">
            <div className="spinner" />
            <p>Loading server…</p>
          </div>
        )}

        {!loading && error && !result && (
          <div className="state-card state-error">
            <p>{error}</p>
            <BackLink />
          </div>
        )}

        {!loading && server && !result && (
          <section className="panel panel-padded">
            <h2>Remote Reboot</h2>
            <p className="panel-description">
              Enter the Administrator password to remotely reboot this server. The operation
              uses <code>net use</code>, <code>shutdown /r</code>, and connection cleanup.
            </p>

            <form onSubmit={handleSubmit}>
              <label className="field-label" htmlFor="admin-password">
                Administrator password
              </label>
              <input
                id="admin-password"
                type="password"
                className="field-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoFocus
                disabled={submitting}
              />

              {error && <p className="field-error">{error}</p>}

              <div className="form-actions">
                <BackLink />
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? "Executing reset…" : "Execute Reset"}
                </button>
              </div>
            </form>
          </section>
        )}

        {result && (
          <section className="results">
            <div className={`summary-card summary-${isSuccess ? "success" : "failure"}`}>
              <div className="summary-status">
                <span className={`status-dot status-${isSuccess ? "success" : "failure"}`} />
                <div>
                  <h2>{isSuccess ? "Reset Successful" : "Reset Failed"}</h2>
                  <p>{result.message}</p>
                </div>
              </div>

              <dl className="summary-grid">
                <div>
                  <dt>Hostname</dt>
                  <dd>{result.hostname}</dd>
                </div>
                <div>
                  <dt>IP Address</dt>
                  <dd>{result.ip}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{formatTimestamp(result.started_at)}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{formatTimestamp(result.finished_at)}</dd>
                </div>
                <div>
                  <dt>Execution Time</dt>
                  <dd>{formatDuration(result.execution_time_ms)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className={isSuccess ? "text-success" : "text-danger"}>
                    {result.status}
                  </dd>
                </div>
              </dl>
            </div>

            <section className="panel">
              <div className="panel-header">
                <h2>Command Log &amp; Analysis</h2>
                <span className="badge">
                  {result.steps?.length ?? 0} step{(result.steps?.length ?? 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="step-list">
                {(result.steps ?? []).map((step, index) => (
                  <article
                    key={`${step.command}-${index}`}
                    className={`step-card step-${step.success ? "success" : "failure"}`}
                  >
                    <div className="step-header">
                      <span className={`step-badge step-badge-${step.success ? "ok" : "err"}`}>
                        Step {index + 1}
                      </span>
                      <span className="step-duration">{formatDuration(step.duration_ms)}</span>
                    </div>
                    <pre className="step-command">{step.command}</pre>
                    <pre className="step-output">{step.output}</pre>
                  </article>
                ))}
              </div>
            </section>

            <div className="form-actions">
              <BackLink />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setResult(null);
                  setPassword("");
                  setError("");
                }}
              >
                Run Again
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
