"""Parse prometheus.yml and extract windows_exporter server targets."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

JOB_NAME = "windows_exporter"


def get_prometheus_path() -> Path:
    """Return path to prometheus.yml.

    Checks the ``PROMETHEUS_YML_PATH`` environment variable first,
    falling back to ``../../prometheus.yml`` relative to this file
    (i.e. the project root).
    """
    env_path = os.getenv("PROMETHEUS_YML_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[2] / "prometheus.yml"


def _parse_target(target: str) -> tuple[str, str]:
    """Split a ``host:port`` target string into (host, port)."""
    if ":" in target:
        host, _, port = target.rpartition(":")
        return host.strip(), port.strip()
    return target.strip(), ""


def _extract_servers_from_job(job: dict[str, Any]) -> list[dict[str, str]]:
    """Walk ``static_configs`` inside a scrape job and build server dicts."""
    servers: list[dict[str, str]] = []

    for static_config in job.get("static_configs") or []:
        labels: dict[str, str] = static_config.get("labels") or {}
        targets: list[str] = static_config.get("targets") or []

        for target in targets:
            if not isinstance(target, str):
                continue

            ip, port = _parse_target(target)
            servers.append(
                {
                    "hostname": str(labels.get("srv_name", "")).strip(),
                    "ip": ip,
                    "port": port,
                    "system": str(labels.get("system", "")).strip(),
                    "team": str(labels.get("team", "")).strip(),
                }
            )

    return servers


def load_servers(yaml_path: Path | None = None) -> list[dict[str, str]]:
    """Load all server entries from the ``windows_exporter`` job.

    Returns a list of dicts, each with keys:
    ``hostname``, ``ip``, ``port``, ``system``, ``team``.
    """
    path = yaml_path or get_prometheus_path()

    if not path.is_file():
        raise FileNotFoundError(f"prometheus.yml not found at {path}")

    with path.open(encoding="utf-8") as fh:
        config: dict[str, Any] = yaml.safe_load(fh) or {}

    servers: list[dict[str, str]] = []
    for job in config.get("scrape_configs") or []:
        if job.get("job_name") == JOB_NAME:
            servers.extend(_extract_servers_from_job(job))

    return servers


def find_server_by_hostname(
    hostname: str,
    yaml_path: Path | None = None,
) -> dict[str, str] | None:
    """Find a single server entry by its hostname (case-insensitive)."""
    normalised = hostname.strip().lower()
    for server in load_servers(yaml_path):
        if server["hostname"].lower() == normalised:
            return server
    return None
