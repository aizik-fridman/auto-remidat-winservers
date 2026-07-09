import { useNavigate } from "react-router-dom";

/**
 * Maps system names to badge variants.
 */
function systemBadgeVariant(system) {
  if (!system) return "muted";
  const s = system.toLowerCase();
  if (s.includes("prod")) return "danger";
  if (s.includes("dev")) return "primary";
  if (s.includes("staging") || s.includes("stg")) return "accent";
  if (s.includes("test")) return "success";
  return "muted";
}

/**
 * ServerTable — renders servers as a responsive card grid.
 *
 * Props:
 *  - servers: array of { hostname, ip, system, team, ... }
 */
export default function ServerTable({ servers }) {
  const navigate = useNavigate();

  if (!servers || servers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">🖥️</div>
        <p className="empty-state__text">No servers found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="count-badge">
        <span className="count-badge__number">{servers.length}</span>
        <span>server{servers.length !== 1 ? "s" : ""} available</span>
      </div>

      <div className="server-grid">
        {servers.map((server) => (
          <div key={server.hostname} className="server-card">
            <div className="server-card__header">
              <div>
                <div className="server-card__hostname">
                  {server.hostname}
                  {server.os && (
                    <span style={{marginLeft: "0.5rem", fontSize: "0.8em", opacity: 0.8}}>
                      {server.os === "linux" ? "🐧 Linux" : "🪟 Windows"}
                    </span>
                  )}
                </div>
                <div className="server-card__ip">{server.ip}</div>
              </div>
            </div>

            <div className="server-card__meta">
              {server.system && (
                <span className={`badge badge--${systemBadgeVariant(server.system)}`}>
                  <span className="badge__dot" />
                  {server.system}
                </span>
              )}
              {server.team && (
                <span className="server-card__team">👥 {server.team}</span>
              )}
            </div>

            <div className="server-card__actions">
              <button
                className="btn btn--danger btn--sm"
                onClick={() => navigate(`/reset/${server.hostname}`)}
              >
                ⚡ Reset
              </button>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => navigate(`/console/${server.hostname}`)}
              >
                &gt;_ Console
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
