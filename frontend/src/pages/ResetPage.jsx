import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import { fetchServer, resetServer } from "../api.js";

/**
 * ResetPage — password form, submission, and results timeline.
 */
export default function ResetPage() {
  const { hostname } = useParams();
  const navigate = useNavigate();

  const [serverInfo, setServerInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await fetchServer(hostname);
        if (!cancelled) setServerInfo(info);
      } catch {
        // not critical — we still have hostname
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hostname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const data = await resetServer(hostname, password);
      setResult(data);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAgain = () => {
    setResult(null);
    setError(null);
    setPassword("");
  };

  const subtitle = serverInfo
    ? [serverInfo.ip, serverInfo.system, serverInfo.team].filter(Boolean).join(" · ")
    : hostname;

  const isSuccess = result?.status === true || result?.status === "success";

  return (
    <>
      <PageHeader
        eyebrow="Reset Procedure"
        title={hostname}
        subtitle={subtitle}
        backTo="/all-servers"
        backLabel="All Servers"
      />

      <main className="page-wrapper">
        {/* Password form */}
        {!result && !submitting && (
          <div className="reset-form-panel glass-panel">
            <h2 className="reset-form-panel__title">🔐 Authentication Required</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-pw">
                  Administrator Password
                </label>
                <input
                  id="reset-pw"
                  className="input-field"
                  type="password"
                  placeholder="Enter password…"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && (
                <p style={{ color: "var(--error-red)", fontSize: "0.85rem" }}>
                  ⚠ {error}
                </p>
              )}
              <button className="btn btn--danger btn--lg" type="submit">
                ⚡ Execute Reset
              </button>
            </form>
          </div>
        )}

        {/* Submitting state */}
        {submitting && (
          <div className="loading-state">
            <div className="spinner" />
            <p className="loading-state__text">
              Executing reset on {hostname}…
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Status card */}
            <div
              className={`result-status ${
                isSuccess ? "result-status--success" : "result-status--failure"
              }`}
            >
              <div className="result-status__icon">
                {isSuccess ? "✅" : "⚠️"}
              </div>
              <div className="result-status__label">
                {isSuccess ? "Reset Successful" : "Reset Failed"}
              </div>
            </div>

            {/* Summary grid */}
            <div className="summary-grid">
              <SummaryItem label="Hostname" value={result.hostname || hostname} />
              <SummaryItem label="IP Address" value={result.ip} mono />
              <SummaryItem label="Started" value={formatTime(result.started_at)} />
              <SummaryItem label="Finished" value={formatTime(result.finished_at)} />
              <SummaryItem
                label="Execution Time"
                value={result.execution_time_ms != null ? `${(result.execution_time_ms / 1000).toFixed(2)}s` : "—"}
              />
              <SummaryItem
                label="Status"
                value={isSuccess ? "Success" : "Failed"}
              />
            </div>

            {/* Command log */}
            {result.steps && result.steps.length > 0 && (
              <div style={{ marginTop: "var(--sp-6)" }}>
                <h3 className="section-heading">Command Log</h3>
                <div className="step-timeline">
                  {result.steps.map((step, i) => {
                    const stepSuccess = step.success === true;
                    return (
                      <div key={i} className="step-card glass-panel">
                        <div className="step-card__header">
                          <span
                            className={`step-card__number ${
                              stepSuccess
                                ? "step-card__number--success"
                                : "step-card__number--failure"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="step-card__command">
                            {step.command}
                          </span>
                          {step.duration_ms != null && (
                            <span className="step-card__duration">
                              {(step.duration_ms / 1000).toFixed(2)}s
                            </span>
                          )}
                          <span
                            className={`badge badge--${
                              stepSuccess ? "success" : "error"
                            }`}
                          >
                            <span className="badge__dot" />
                            {stepSuccess ? "OK" : "FAIL"}
                          </span>
                        </div>
                        {step.output && (
                          <pre className="step-card__output">{step.output}</pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="result-actions">
              <button className="btn btn--danger" onClick={handleRunAgain}>
                ⚡ Run Again
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => navigate("/all-servers")}
              >
                ← Back to Servers
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/* Helper components */

function SummaryItem({ label, value, mono }) {
  return (
    <div className="summary-item glass-panel">
      <div className="summary-item__label">{label}</div>
      <div
        className={`summary-item__value ${
          mono ? "summary-item__value--mono" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
