"""Parse prometheus.yml and extract windows_exporter server targets."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

JOB_NAME = "windows_exporter"
LABEL_KEYS = ("system", "team", "srv_name")


def get_prometheus_path() -> Path:
    env_path = os.getenv("PROMETHEUS_YML_PATH")
    if env_path:
        return Path(env_path)
    return Path(__file__).resolve().parents[2] / "prometheus.yml"


def _parse_target(target: str) -> tuple[str, str]:
    if ":" in target:
        host, _, port = target.rpartition(":")
        return host.strip(), port.strip()
    return target.strip(), ""


def _extract_servers_from_job(job: dict[str, Any]) -> list[dict[str, str]]:
    servers: list[dict[str, str]] = []

    for static_config in job.get("static_configs") or []:
        labels = static_config.get("labels") or {}
        targets = static_config.get("targets") or []

        for target in targets:
            if not isinstance(target, str):
                continue

            ip, port = _parse_target(target)
            server = {
                "hostname": str(labels.get("srv_name", "")).strip(),
                "ip": ip,
                "port": port,
                "system": str(labels.get("system", "")).strip(),
                "team": str(labels.get("team", "")).strip(),
            }
            servers.append(server)

    return servers


def load_servers(yaml_path: Path | None = None) -> list[dict[str, str]]:
    path = yaml_path or get_prometheus_path()

    if not path.is_file():
        raise FileNotFoundError(f"prometheus.yml not found at {path}")

    with path.open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}

    scrape_configs = config.get("scrape_configs") or []
    servers: list[dict[str, str]] = []

    for job in scrape_configs:
        if job.get("job_name") == JOB_NAME:
            servers.extend(_extract_servers_from_job(job))

    return servers


def find_server_by_hostname(
    hostname: str, yaml_path: Path | None = None
) -> dict[str, str] | None:
    normalized = hostname.strip().lower()
    for server in load_servers(yaml_path):
        if server["hostname"].lower() == normalized:
            return server
    return None
