import { Link } from "react-router-dom";

export default function ServerTable({ servers }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>All Servers</h2>
        <span className="badge">{servers.length} total</span>
      </div>

      <div className="table-wrap">
        <table className="server-table">
          <thead>
            <tr>
              <th>Hostname</th>
              <th>IP</th>
              <th>System</th>
              <th>Team</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr key={`${server.hostname}-${server.ip}-${server.port}`}>
                <td>
                  <span className="hostname">{server.hostname || "—"}</span>
                </td>
                <td>
                  <code className="mono">
                    {server.ip}
                    {server.port ? `:${server.port}` : ""}
                  </code>
                </td>
                <td>
                  <span className="tag">{server.system || "—"}</span>
                </td>
                <td>{server.team || "—"}</td>
                <td>
                  <div className="row-actions">
                    <Link
                      to={`/reset/${encodeURIComponent(server.hostname)}`}
                      className="btn btn-danger btn-sm"
                    >
                      Reset
                    </Link>
                    <Link
                      to={`/console/${encodeURIComponent(server.hostname)}`}
                      className="btn btn-primary btn-sm"
                    >
                      Console
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
