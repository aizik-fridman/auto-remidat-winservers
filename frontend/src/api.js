const API_BASE = import.meta.env.VITE_API_URL || "";

export async function fetchServers() {
  const response = await fetch(`${API_BASE}/all-servers`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Failed to load servers");
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
    throw new Error(data.detail || "Reset failed");
  }
  return data;
}

export async function downloadConsole(hostname, password) {
  const response = await fetch(`${API_BASE}/console/${encodeURIComponent(hostname)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Console download failed");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || `${hostname}.rdp`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
