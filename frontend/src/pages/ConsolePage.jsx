import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import PageHeader from "../components/PageHeader.jsx";
import { consoleWebSocketUrl, fetchServer } from "../api.js";
import emergencyCommands from "../constants/emergencyCommands.js";
import emergencyCommandsLinux from "../constants/emergencyCommandsLinux.js";

const PROMPT_WIN = "\x1b[38;2;59;130;246mC:\\>\x1b[0m ";
const PROMPT_LINUX = "\x1b[38;2;16;185;129m$ \x1b[0m ";


/**
 * ConsolePage — command-at-a-time web console with xterm.js.
 */
export default function ConsolePage() {
  const { hostname } = useParams();

  const [serverInfo, setServerInfo] = useState(null);
  const [phase, setPhase] = useState("auth"); // "auth" | "connecting" | "connected"
  const [password, setPassword] = useState("");
  const [diagnostics, setDiagnostics] = useState([]);

  const termRef = useRef(null);
  const termContainerRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const inputBufferRef = useRef("");
  const waitingForOutputRef = useRef(false);

  // Load server info
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await fetchServer(hostname);
        if (!cancelled) setServerInfo(info);
      } catch {
        // non-critical
      }
    })();
    return () => { cancelled = true; };
  }, [hostname]);

  // Initialize terminal
  const initTerminal = useCallback(() => {
    if (termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
      theme: {
        background: "hsl(222, 47%, 5%)",
        foreground: "hsl(210, 40%, 92%)",
        cursor: "hsl(217, 91%, 60%)",
        selectionBackground: "hsla(217, 91%, 60%, 0.3)",
        black: "#1e293b",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#8b5cf6",
        cyan: "#06b6d4",
        white: "#e2e8f0",
        brightBlack: "#475569",
        brightRed: "#f87171",
        brightGreen: "#34d399",
        brightYellow: "#fbbf24",
        brightBlue: "#60a5fa",
        brightMagenta: "#a78bfa",
        brightCyan: "#22d3ee",
        brightWhite: "#f8fafc",
      },
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    if (termContainerRef.current) {
      term.open(termContainerRef.current);
      fitAddon.fit();
    }

    termRef.current = term;
  }, []);

  // Fit on resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        try { fitAddonRef.current.fit(); } catch { /* ignore */ }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Connect WebSocket
  const connect = useCallback(
    (pw) => {
      setPhase("connecting");
      setDiagnostics([{ label: "Establishing connection…", status: "pending" }]);

      initTerminal();

      const url = consoleWebSocketUrl(hostname);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setDiagnostics((d) => [
          ...d.map((x) =>
            x.status === "pending" ? { ...x, status: "ok" } : x
          ),
          { label: "Authenticating…", status: "pending" },
        ]);
        ws.send(JSON.stringify({ password: pw }));
      };

      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (msg.type === "connected") {
          setDiagnostics((d) => [
            ...d.map((x) =>
              x.status === "pending" ? { ...x, status: "ok" } : x
            ),
            { label: "Session active", status: "ok" },
          ]);
          setPhase("connected");

          const term = termRef.current;
          if (term) {
            term.writeln(
              `\x1b[38;2;16;185;129m${msg.message || "Connected."}\x1b[0m`
            );
            term.writeln("");
            const promptStr = serverInfo?.os === "linux" ? PROMPT_LINUX : PROMPT_WIN;
            term.write(promptStr);

            // Handle key input
            term.onData((data) => {
              // Ctrl+C
              if (data === "\x03") {
                inputBufferRef.current = "";
                waitingForOutputRef.current = false;
                term.writeln("^C");
                term.write(promptStr);
                return;
              }

              // If waiting for command output, ignore input
              if (waitingForOutputRef.current) return;

              // Enter
              if (data === "\r" || data === "\n") {
                const cmd = inputBufferRef.current.trim();
                inputBufferRef.current = "";
                term.writeln(""); // newline after command

                if (cmd.length === 0) {
                  term.write(promptStr);
                  return;
                }

                // Send command
                waitingForOutputRef.current = true;
                term.writeln(
                  "\x1b[2m⏳ Executing…\x1b[0m"
                );
                ws.send(JSON.stringify({ type: "input", data: cmd }));
                return;
              }

              // Backspace
              if (data === "\x7f" || data === "\b") {
                if (inputBufferRef.current.length > 0) {
                  inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                  term.write("\b \b");
                }
                return;
              }

              // Ignore control chars
              if (data.charCodeAt(0) < 32) return;

              // Regular character — local echo
              inputBufferRef.current += data;
              term.write(data);
            });
          }
        } else if (msg.type === "output") {
          const term = termRef.current;
          if (term) {
            const lines = (msg.data || "").replace(/\r?\n/g, "\r\n");
            term.writeln(lines);
            const promptStr = serverInfo?.os === "linux" ? PROMPT_LINUX : PROMPT_WIN;
            term.write(promptStr);
            waitingForOutputRef.current = false;
          }
        } else if (msg.type === "error") {
          const term = termRef.current;
          if (term) {
            term.writeln(
              `\x1b[38;2;239;68;68m${msg.data || msg.message || "Error"}\x1b[0m`
            );
            const promptStr = serverInfo?.os === "linux" ? PROMPT_LINUX : PROMPT_WIN;
            term.write(promptStr);
            waitingForOutputRef.current = false;
          }
        }
      };

      ws.onerror = () => {
        setDiagnostics((d) => [
          ...d.map((x) =>
            x.status === "pending" ? { ...x, status: "error" } : x
          ),
          { label: "Connection error", status: "error" },
        ]);
      };

      ws.onclose = () => {
        const term = termRef.current;
        if (term) {
          term.writeln("");
          term.writeln(
            "\x1b[38;2;239;68;68m[Connection closed]\x1b[0m"
          );
        }
        setPhase("auth");
        waitingForOutputRef.current = false;
      };
    },
    [hostname, initTerminal]
  );

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setPhase("auth");
    waitingForOutputRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (termRef.current) termRef.current.dispose();
    };
  }, []);

  // Fit terminal when phase becomes "connected"
  useEffect(() => {
    if (phase === "connected" && fitAddonRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current.fit(); } catch { /* ignore */ }
      }, 50);
    }
  }, [phase]);

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    connect(password);
  };

  // Prefill emergency command
  const prefillCommand = (cmd) => {
    const term = termRef.current;
    if (!term || waitingForOutputRef.current) return;

    // Clear current input
    const currentLen = inputBufferRef.current.length;
    for (let i = 0; i < currentLen; i++) {
      term.write("\b \b");
    }

    inputBufferRef.current = cmd;
    term.write(cmd);
  };

  const subtitle = serverInfo
    ? [serverInfo.ip, serverInfo.system, serverInfo.team].filter(Boolean).join(" · ")
    : hostname;

  return (
    <>
      <PageHeader
        eyebrow="Web Console"
        title={hostname}
        subtitle={subtitle}
        backTo="/all-servers"
        backLabel="All Servers"
      >
        {phase === "connected" && (
          <button className="btn btn--danger btn--sm" onClick={disconnect}>
            ✕ Disconnect
          </button>
        )}
      </PageHeader>

      <main
        className="page-wrapper"
        style={{ display: "flex", flexDirection: "column", flex: 1 }}
      >
        {/* Auth form */}
        {phase === "auth" && (
          <div className="console-password-form glass-panel">
            <h2 className="console-password-form__title">
              🔐 Connect to {hostname}
            </h2>
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="console-pw">
                  Administrator Password
                </label>
                <input
                  id="console-pw"
                  className="input-field"
                  type="password"
                  placeholder="Enter password…"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button className="btn btn--primary btn--lg" type="submit">
                ▶ Connect
              </button>
            </form>
          </div>
        )}

        {/* Connecting diagnostics */}
        {phase === "connecting" && (
          <div>
            <div className="diagnostics-panel glass-panel">
              <div className="sidebar-panel__title">
                Connection Diagnostics
              </div>
              {diagnostics.map((d, i) => (
                <div key={i} className="diagnostics-item">
                  <span
                    className={`diagnostics-item__dot diagnostics-item__dot--${d.status}`}
                  />
                  {d.label}
                </div>
              ))}
            </div>
            <div
              ref={termContainerRef}
              style={{ height: 0, overflow: "hidden" }}
            />
          </div>
        )}

        {/* Connected: terminal + sidebar */}
        {phase === "connected" && (
          <div className="console-layout" style={{ flex: 1 }}>
            <div
              className="terminal-chrome"
              style={{ display: "flex", flexDirection: "column" }}
            >
              <div className="terminal-chrome__bar">
                <div className="terminal-chrome__dots">
                  <span className="terminal-chrome__dot terminal-chrome__dot--red" />
                  <span className="terminal-chrome__dot terminal-chrome__dot--yellow" />
                  <span className="terminal-chrome__dot terminal-chrome__dot--green" />
                </div>
                <span className="terminal-chrome__title">
                  {hostname} — Remote Console
                </span>
                <span className="live-badge">
                  <span className="live-badge__dot" />
                  Live
                </span>
              </div>
              <div
                className="terminal-chrome__body"
                ref={(el) => {
                  if (el && !termContainerRef.current?.parentElement?.classList?.contains("terminal-chrome")) {
                    termContainerRef.current = el;
                    if (termRef.current) {
                      // Re-open terminal in new container
                      el.innerHTML = "";
                      termRef.current.open(el);
                      if (fitAddonRef.current) {
                        setTimeout(() => {
                          try { fitAddonRef.current.fit(); } catch { /* ignore */ }
                        }, 50);
                      }
                    }
                  }
                }}
                style={{ flex: 1, minHeight: "400px" }}
              />
            </div>

            <div className="console-sidebar">
              <div className="sidebar-panel glass-panel">
                <div className="sidebar-panel__title">
                  ⚡ Emergency Commands
                </div>
                <ul className="emergency-list">
                  {(serverInfo?.os === "linux" ? emergencyCommandsLinux : emergencyCommands).map((ec) => (
                    <li key={ec.label}>
                      <button
                        className="emergency-btn"
                        onClick={() => prefillCommand(ec.command)}
                      >
                        {ec.label}
                        <span className="emergency-btn__shell">{ec.shell}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sidebar-panel glass-panel">
                <div className="sidebar-panel__title">Diagnostics</div>
                {diagnostics.map((d, i) => (
                  <div key={i} className="diagnostics-item">
                    <span
                      className={`diagnostics-item__dot diagnostics-item__dot--${d.status}`}
                    />
                    {d.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
