const API_BASE = "/api";

export async function fetchServers() {
  const response = await fetch(`${API_BASE}/all-servers`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to load servers");
  }
  return response.json();
}

export async function fetchServer(hostname) {
  const response = await fetch(`${API_BASE}/servers/${encodeURIComponent(hostname)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Server not found");
  }
  return response.json();
}

export async function resetServer(hostname, password) {
  const response = await fetch(`${API_BASE}/reset/${encodeURIComponent(hostname)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    if (typeof detail === "object" && detail !== null) {
      return detail;
    }
    throw new Error(detail || data.message || "Reset failed");
  }
  return data;
}

export function consoleWebSocketUrl(hostname) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/console/${encodeURIComponent(hostname)}`;
}
