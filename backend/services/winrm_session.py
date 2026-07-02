"""Command-at-a-time WinRM session wrapper using pywinrm.

Each command is executed independently — no persistent interactive shell
is maintained.  This avoids the HTTP 400 errors caused by long-lived
``Protocol.open_shell`` / ``send_command_input`` sessions.
"""

from __future__ import annotations

import os
import re
from typing import Any

import winrm


# PowerShell cmdlet prefixes that signal a command should be routed through
# ``session.run_ps`` instead of ``session.run_cmd``.
_PS_CMDLET_PREFIXES: tuple[str, ...] = (
    "get-",
    "set-",
    "new-",
    "remove-",
    "invoke-",
    "start-",
    "stop-",
    "restart-",
    "test-",
    "import-",
    "export-",
    "select-",
    "where-",
    "foreach-",
    "format-",
    "out-",
    "write-",
    "read-",
    "clear-",
    "add-",
    "enable-",
    "disable-",
    "enter-",
    "exit-",
    "register-",
    "unregister-",
    "measure-",
    "update-",
    "sort-",
    "group-",
    "compare-",
    "convertto-",
    "convertfrom-",
    "resolve-",
    "copy-",
    "move-",
    "rename-",
    "split-",
    "join-",
    "tee-",
    "wait-",
    "debug-",
    "trace-",
    "show-",
    "find-",
    "save-",
    "install-",
    "uninstall-",
    "publish-",
    "use-",
)

# Regex that matches common PowerShell-only syntax.
_PS_SYNTAX_RE = re.compile(r"[$@{}\[\]]|\|.*(?:where|select|foreach|format)")


def _is_powershell(cmd: str) -> bool:
    """Heuristic: return ``True`` when *cmd* looks like PowerShell."""
    first_token = cmd.strip().split()[0].lower() if cmd.strip() else ""
    if first_token.startswith(_PS_CMDLET_PREFIXES):
        return True
    if _PS_SYNTAX_RE.search(cmd):
        return True
    return False


class WinRMSession:
    """Thin wrapper around :class:`winrm.Session` that runs one command at a
    time and auto-detects CMD vs PowerShell.

    No persistent shell is kept open between calls — each
    :meth:`run_command` invocation creates and tears down its own WinRM
    shell automatically (handled internally by pywinrm).
    """

    def __init__(
        self,
        host: str,
        password: str,
        username: str = "Administrator",
        port: int | None = None,
        use_ssl: bool | None = None,
        transport: str | None = None,
    ) -> None:
        self.host = host
        self.username = username
        self.port = port or int(os.getenv("WINRM_PORT", "5985"))

        if use_ssl is not None:
            self.use_ssl = use_ssl
        else:
            self.use_ssl = os.getenv("WINRM_USE_SSL", "").lower() in (
                "1",
                "true",
                "yes",
            )

        self.transport = transport or os.getenv("WINRM_TRANSPORT", "ntlm")

        scheme = "https" if self.use_ssl else "http"
        self.endpoint = f"{scheme}://{host}:{self.port}/wsman"

        self._session = winrm.Session(
            target=self.endpoint,
            auth=(username, password),
            transport=self.transport,
            server_cert_validation="ignore",
        )

    # --------------------------------------------------------------------- #
    #  Public API                                                            #
    # --------------------------------------------------------------------- #

    def run_command(self, cmd_str: str) -> dict[str, Any]:
        """Execute *cmd_str* and return ``{stdout, stderr, exit_code}``.

        If the command looks like PowerShell it is sent via
        :pymethod:`winrm.Session.run_ps`, otherwise via
        :pymethod:`winrm.Session.run_cmd`.
        """
        cmd_str = cmd_str.strip()
        if not cmd_str:
            return {"stdout": "", "stderr": "Empty command", "exit_code": -1}

        if _is_powershell(cmd_str):
            result = self._session.run_ps(cmd_str)
        else:
            result = self._session.run_cmd(cmd_str)

        stdout = (result.std_out or b"").decode("utf-8", errors="replace").strip()
        stderr = (result.std_err or b"").decode("utf-8", errors="replace").strip()

        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": result.status_code,
        }

    def test_connection(self) -> dict[str, Any]:
        """Run ``hostname`` to verify connectivity."""
        return self.run_command("hostname")
