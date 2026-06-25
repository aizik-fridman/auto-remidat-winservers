import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { consoleWebSocketUrl, fetchServer } from "../api";
import { EMERGENCY_COMMANDS } from "../constants/emergencyCommands";
import { BackLink } from "../components/PageHeader";
import PageHeader from "../components/PageHeader";
import "@xterm/xterm/css/xterm.css";

function toCmdCommand(entry) {
  if (entry.shell === "powershell") {
    const escaped = entry.command.replace(/"/g, '\\"');
    return `powershell -NoProfile -Command "${escaped}"`;
  }
  return entry.command;
}

export default function ConsolePage() {
  const { hostname } = useParams();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddon = useRef(null);
  const wsRef = useRef(null);
  const inputBuffer = useRef("");

  useEffect(() => {
    loadServer();
    return () => {
      disconnect();
    };
  }, [hostname]);

  useEffect(() => {
    if (!connected) return undefined;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"Consolas", "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: "#0b0d10",
        foreground: "#e8eaed",
        cursor: "#4c8dff",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    termInstance.current = term;
    fitAddon.current = fit;
    inputBuffer.current = "";

    term.writeln(`Connected to ${hostname}. Type commands and press Enter.\r\n`);

    term.onData((data) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (data === "\r") {
        ws.send(JSON.stringify({ type: "input", data: `${inputBuffer.current}\r\n` }));
        term.write("\r\n");
        inputBuffer.current = "";
        return;
      }

      if (data === "\u007f") {
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }

      if (data === "\u0003") {
        ws.send(JSON.stringify({ type: "input", data: "\u0003" }));
        inputBuffer.current = "";
        return;
      }

      if (data >= " ") {
        inputBuffer.current += data;
        term.write(data);
      }
    });

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termInstance.current = null;
      fitAddon.current = null;
    };
  }, [connected, hostname]);

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

  function disconnect() {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "close" }));
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setConnected(false);
  }

  async function handleConnect(event) {
    event.preventDefault();
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setConnecting(true);
    setError("");
    setStatusMessage("Opening WinRM session…");

    const ws = new WebSocket(consoleWebSocketUrl(hostname));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ password }));
    };

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "connected") {
        setConnected(true);
        setConnecting(false);
        setStatusMessage(message.message);
        return;
      }

      if (message.type === "output") {
        termInstance.current?.write(message.data);
        return;
      }

      if (message.type === "error") {
        setError(message.message);
        setConnecting(false);
        disconnect();
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection failed");
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      if (termInstance.current) {
        termInstance.current.writeln("\r\n[session closed]");
      }
    };
  }

  const prefillCommand = useCallback((entry) => {
    const term = termInstance.current;
    const ws = wsRef.current;
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return;

    const command = toCmdCommand(entry);
    inputBuffer.current = command;
    term.write(command);
  }, []);

  return (
    <div className="app console-app">
      <PageHeader
        eyebrow="Web Console"
        title={hostname}
        subtitle={
          server ? (
            <>
              {server.ip}
              {server.port ? `:${server.port}` : ""} · WinRM interactive session
            </>
          ) : (
            "Loading server details…"
          )
        }
      >
        <div className="header-actions">
          {connected && (
            <button type="button" className="btn btn-danger btn-sm" onClick={disconnect}>
              Disconnect
            </button>
          )}
          <BackLink />
        </div>
      </PageHeader>

      <main className="main console-main">
        {loading && (
          <div className="state-card">
            <div className="spinner" />
            <p>Loading server…</p>
          </div>
        )}

        {!loading && error && !connected && (
          <div className="state-card state-error">
            <p>{error}</p>
            <BackLink />
          </div>
        )}

        {!loading && server && !connected && (
          <section className="panel panel-padded connect-panel">
            <h2>Connect to Console</h2>
            <p className="panel-description">
              Enter the Administrator password to open an interactive WinRM session. Input and
              output are streamed over a secure WebSocket connection.
            </p>

            <form onSubmit={handleConnect}>
              <label className="field-label" htmlFor="console-password">
                Administrator password
              </label>
              <input
                id="console-password"
                type="password"
                className="field-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoFocus
                disabled={connecting}
              />

              {error && <p className="field-error">{error}</p>}
              {connecting && <p className="field-hint">{statusMessage}</p>}

              <div className="form-actions">
                <BackLink />
                <button type="submit" className="btn btn-primary" disabled={connecting}>
                  {connecting ? "Connecting…" : "Connect"}
                </button>
              </div>
            </form>
          </section>
        )}

        {connected && (
          <div className="console-layout">
            <section className="terminal-panel panel">
              <div className="panel-header">
                <h2>Terminal</h2>
                <span className="badge badge-live">Live</span>
              </div>
              <div className="terminal-wrap" ref={terminalRef} />
            </section>

            <aside className="sidebar panel">
              <div className="panel-header">
                <h2>Emergency Commands</h2>
              </div>
              <p className="sidebar-hint">
                Click a command to fill the prompt. Press Enter in the terminal to execute.
              </p>
              <ul className="command-list">
                {EMERGENCY_COMMANDS.map((entry) => (
                  <li key={entry.label}>
                    <button
                      type="button"
                      className="command-btn"
                      onClick={() => prefillCommand(entry)}
                    >
                      <span className="command-label">{entry.label}</span>
                      <code className="command-preview">{toCmdCommand(entry)}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
