# Windows Server Manager

A full-stack web application for managing and monitoring Windows servers. Server inventory is read from a local `prometheus.yml` file (the `windows_exporter` scrape job), and operators can remotely reboot servers or download RDP console files.

## Features

- **Dark, minimalist UI** — server table with hostname, IP/port, system, and team
- **YAML-driven inventory** — parses `scrape_configs` for job `windows_exporter`
- **Reset** — remote reboot via `net use`, `shutdown /r`, and cleanup
- **Console** — generates and downloads an `.rdp` file for Remote Desktop
- **Auth modal** — centralized password prompt per server action

## Project Structure

```
auto-remidat-winservers/
├── prometheus.yml          # Server inventory (sample included)
├── backend/
│   ├── main.py             # FastAPI application
│   ├── requirements.txt
│   └── services/
│       ├── yaml_parser.py  # Parse prometheus.yml
│       ├── reset_service.py
│       └── rdp_service.py
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── api.js
        ├── index.css
        └── components/
            ├── AuthModal.jsx
            └── ServerTable.jsx
```

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Windows** (required for Reset and RDP password embedding)
- A valid `prometheus.yml` with a `windows_exporter` job

### prometheus.yml format

```yaml
scrape_configs:
  - job_name: windows_exporter
    static_configs:
      - targets:
          - 192.168.1.10:9182
        labels:
          system: Production
          team: Infrastructure
          srv_name: WEB-SRV-01
```

## Setup

### 1. Configure prometheus.yml

Replace the sample `prometheus.yml` in the project root with your real Prometheus config, or point the backend to it:

```powershell
$env:PROMETHEUS_YML_PATH = "C:\path\to\prometheus.yml"
```

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 3. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies API requests to the backend on port 8000.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/all-servers` | Returns JSON array of servers from YAML |
| POST | `/reset/{hostname}` | Body: `{ "password": "..." }` — remote reboot |
| POST | `/console/{hostname}` | Body: `{ "password": "..." }` — downloads `.rdp` file |
| GET | `/health` | Health check |

### Example: GET /all-servers

```json
[
  {
    "hostname": "WEB-SRV-01",
    "ip": "192.168.1.10",
    "port": "9182",
    "system": "Production",
    "team": "Infrastructure"
  }
]
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_YML_PATH` | `../prometheus.yml` (project root) | Path to prometheus config |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `VITE_API_URL` | `""` (uses Vite proxy in dev) | Frontend API base URL for production builds |

## Production Build

```powershell
# Backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm run build
npm run preview
```

Set `VITE_API_URL=http://your-backend-host:8000` before `npm run build` if the API is on a different origin.

## Security Notes

- Passwords are sent over HTTPS in production; use TLS when deploying.
- Reset requires local Windows credentials and network access to target IPC$.
- RDP passwords are encrypted with Windows `CryptProtectData` when running on Windows.
- Restrict who can reach this application — it performs privileged remote operations.

## License

MIT
