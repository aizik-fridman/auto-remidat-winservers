"""Remote Windows server reboot via ``net use`` + ``shutdown /r``."""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class CommandStep:
    """One shell command executed during the reset sequence."""

    command: str
    success: bool
    output: str
    duration_ms: int


@dataclass
class ResetResult:
    """Aggregate result of the multi-step reset procedure."""

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
    """Execute *command* in a shell and return a :class:`CommandStep`."""
    started = time.perf_counter()
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return CommandStep(
            command=command,
            success=False,
            output=f"Command timed out after {timeout} seconds",
            duration_ms=timeout * 1000,
        )

    duration_ms = int((time.perf_counter() - started) * 1000)

    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if stdout and stderr:
        output = f"{stdout}\n{stderr}"
    else:
        output = stdout or stderr or "(no output)"

    return CommandStep(
        command=command,
        success=result.returncode == 0,
        output=output,
        duration_ms=duration_ms,
    )


def _escape_password(password: str) -> str:
    """Escape a password for safe use inside a double-quoted CMD argument.

    Characters that have special meaning in cmd.exe are escaped with ``^``
    and embedded double-quotes are doubled (``"`` -> ``""``) so the whole
    token can be wrapped in ``"..."`` safely.
    """
    # Double any embedded double-quotes so they survive the CMD parser.
    escaped = password.replace('"', '""')
    # Escape common CMD meta-characters that could break the command.
    for ch in ("^", "&", "|", "<", ">", "%"):
        escaped = escaped.replace(ch, f"^{ch}")
    return escaped


def reset_server(target_ip: str, password: str) -> ResetResult:
    """Reboot *target_ip* using ``net use`` + ``shutdown /r /m``.

    Steps:
    1. ``net use \\\\IP\\IPC$ /user:Administrator "password"``
    2. ``shutdown /r /m \\\\IP /t 0 /f``
    3. ``net use \\\\IP\\IPC$ /delete``

    If any step fails the sequence is aborted and the partial result is
    returned with ``status="failure"``.
    """
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

    safe_password = _escape_password(password)
    share = f"\\\\{target_ip}\\IPC$"

    commands = [
        f'net use "{share}" /user:Administrator "{safe_password}"',
        f"shutdown /r /m \\\\{target_ip} /t 0 /f",
        f'net use "{share}" /delete /y',
    ]

    steps: list[CommandStep] = []
    for command in commands:
        step = _run_command(command)
        steps.append(step)

        if not step.success:
            finished_at = datetime.now(timezone.utc)
            return ResetResult(
                status="failure",
                message=step.output,
                steps=steps,
                started_at=started_at.isoformat(),
                finished_at=finished_at.isoformat(),
                execution_time_ms=int(
                    (time.perf_counter() - started_perf) * 1000
                ),
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
