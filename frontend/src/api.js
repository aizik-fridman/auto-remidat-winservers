/**
 * API helpers for the Windows Server Manager backend.
 */

export async function fetchServers() {
  const res = await fetch("/api/all-servers");
  if (!res.ok) throw new Error(`Failed to fetch servers: ${res.status}`);
  return res.json();
}

export async function fetchServer(hostname) {
  const res = await fetch(`/api/servers/${encodeURIComponent(hostname)}`);
  if (!res.ok) throw new Error(`Failed to fetch server: ${res.status}`);
  return res.json();
}

export async function resetServer(hostname, username, password) {
  const res = await fetch(`/api/reset/${encodeURIComponent(hostname)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    try {
      const errData = await res.json();
      if (errData && errData.detail && typeof errData.detail === 'object') {
        return errData.detail;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    throw new Error(`Reset failed: ${res.status}`);
  }
  return res.json();
}

export function consoleWebSocketUrl(hostname) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/ws/console/${encodeURIComponent(hostname)}`;
}
