export default function ServerTable({ servers, onAction }) {
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
              <th>IP &amp; Port</th>
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
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onAction(server, "reset")}
                    >
                      Reset
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onAction(server, "console")}
                    >
                      Console
                    </button>
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
