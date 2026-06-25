import { useState } from "react";
import { downloadConsole, resetServer } from "../api";

export default function AuthModal({ server, action, onClose, onSuccess }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isReset = action === "reset";
  const title = isReset ? "Reset Server" : "Open Console";
  const description = isReset
    ? "Enter the Administrator password to remotely reboot this server."
    : "Enter the Administrator password to generate and download an RDP file.";

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (isReset) {
        const result = await resetServer(server.hostname, password);
        onSuccess(result.message || "Reboot initiated successfully");
      } else {
        await downloadConsole(server.hostname, password);
        onSuccess(`RDP file downloaded for ${server.hostname}`);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">{title}</p>
            <h2 id="modal-title">{server.hostname}</h2>
            <p className="modal-meta">
              {server.ip}
              {server.port ? `:${server.port}` : ""} · {server.system} · {server.team}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="modal-description">{description}</p>

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

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${isReset ? "btn-danger" : "btn-primary"}`}
              disabled={submitting}
            >
              {submitting ? "Working…" : isReset ? "Reset Server" : "Download RDP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
