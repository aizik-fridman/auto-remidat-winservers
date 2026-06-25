"""Remote Windows server reboot via net use and shutdown."""

from __future__ import annotations

import subprocess


def reset_server(target_ip: str, password: str) -> tuple[bool, str]:
    if not target_ip.strip():
        return False, "Target IP is empty"
    if not password:
        return False, "Password is required"

    escaped_password = password.replace('"', '\\"')
    share = f"\\\\{target_ip}\\IPC$"

    commands = [
        f'net use "{share}" /user:Administrator "{escaped_password}"',
        f'shutdown /r /m \\\\{target_ip} /t 0 /f',
        f'net use "{share}" /delete',
    ]

    for command in commands:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            stderr = (result.stderr or result.stdout or "").strip()
            return False, stderr or f"Command failed: {command}"

    return True, "Server reboot initiated successfully"
