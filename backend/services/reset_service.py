"""Remote Windows server reboot via net use and shutdown."""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class CommandStep:
    command: str
    success: bool
    output: str
    duration_ms: int


@dataclass
class ResetResult:
    status: str
    message: str
    steps: list[CommandStep] = field(default_factory=list)
    started_at: str = ""
    finished_at: str = ""
    execution_time_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "message": self.message,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "execution_time_ms": self.execution_time_ms,
            "steps": [
                {
                    "command": step.command,
                    "success": step.success,
                    "output": step.output,
                    "duration_ms": step.duration_ms,
                }
                for step in self.steps
            ],
        }


def _run_command(command: str, timeout: int = 60) -> CommandStep:
    started = time.perf_counter()
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    duration_ms = int((time.perf_counter() - started) * 1000)
    output = (result.stdout or "").strip()
    if result.stderr:
        stderr = result.stderr.strip()
        output = f"{output}\n{stderr}".strip() if output else stderr

    return CommandStep(
        command=command,
        success=result.returncode == 0,
        output=output or "(no output)",
        duration_ms=duration_ms,
    )


def reset_server(target_ip: str, password: str) -> ResetResult:
    started_at = datetime.now(timezone.utc)
    started_perf = time.perf_counter()

    if not target_ip.strip():
        return ResetResult(
            status="failure",
            message="Target IP is empty",
            started_at=started_at.isoformat(),
            finished_at=datetime.now(timezone.utc).isoformat(),
        )
    if not password:
        return ResetResult(
            status="failure",
            message="Password is required",
            started_at=started_at.isoformat(),
            finished_at=datetime.now(timezone.utc).isoformat(),
        )

    escaped_password = password.replace('"', '\\"')
    share = f"\\\\{target_ip}\\IPC$"

    commands = [
        f'net use "{share}" /user:Administrator "{escaped_password}"',
        f"shutdown /r /m \\\\{target_ip} /t 0 /f",
        f'net use "{share}" /delete',
    ]

    steps: list[CommandStep] = []
    for command in commands:
        try:
            step = _run_command(command)
        except subprocess.TimeoutExpired:
            step = CommandStep(
                command=command,
                success=False,
                output="Command timed out after 60 seconds",
                duration_ms=60000,
            )
        steps.append(step)
        if not step.success:
            finished_at = datetime.now(timezone.utc)
            return ResetResult(
                status="failure",
                message=step.output,
                steps=steps,
                started_at=started_at.isoformat(),
                finished_at=finished_at.isoformat(),
                execution_time_ms=int((time.perf_counter() - started_perf) * 1000),
            )

    finished_at = datetime.now(timezone.utc)
    return ResetResult(
        status="success",
        message="Server reboot initiated successfully",
        steps=steps,
        started_at=started_at.isoformat(),
        finished_at=finished_at.isoformat(),
        execution_time_ms=int((time.perf_counter() - started_perf) * 1000),
    )
