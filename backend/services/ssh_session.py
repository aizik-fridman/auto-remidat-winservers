"""Command-at-a-time SSH session wrapper using asyncssh."""

from __future__ import annotations

import asyncio
from typing import Any

import asyncssh


class SSHSession:
    """Thin wrapper around asyncssh to run one command at a time."""

    def __init__(
        self,
        host: str,
        password: str,
        username: str = "root",
        port: int = 22,
    ) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.port = port

    # --------------------------------------------------------------------- #
    #  Public API                                                            #
    # --------------------------------------------------------------------- #

    async def run_command(self, cmd_str: str) -> dict[str, Any]:
        """Execute *cmd_str* and return ``{stdout, stderr, exit_code}``."""
        cmd_str = cmd_str.strip()
        if not cmd_str:
            return {"stdout": "", "stderr": "Empty command", "exit_code": -1}

        try:
            async with asyncssh.connect(
                self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                known_hosts=None,
            ) as conn:
                result = await conn.run(cmd_str, check=False)
                
                return {
                    "stdout": str(result.stdout).strip() if result.stdout else "",
                    "stderr": str(result.stderr).strip() if result.stderr else "",
                    "exit_code": result.returncode if result.returncode is not None else -1,
                }
        except asyncssh.Error as exc:
            return {
                "stdout": "",
                "stderr": str(exc),
                "exit_code": -1,
            }

    async def test_connection(self) -> dict[str, Any]:
        """Run ``hostname`` to verify connectivity."""
        return await self.run_command("hostname")
