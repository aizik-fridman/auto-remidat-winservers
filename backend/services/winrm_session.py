"""Interactive WinRM shell session for web terminal streaming."""

from __future__ import annotations

import os
import queue
import threading
import time
import traceback
from typing import Callable

from winrm import Protocol


class WinRMSession:
    """Maintains an open cmd.exe session over WinRM with polled I/O."""

    def __init__(
        self,
        host: str,
        password: str,
        username: str = "Administrator",
        port: int | None = None,
        use_ssl: bool | None = None,
    ) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.port = port or int(os.getenv("WINRM_PORT", "5985"))
        self.use_ssl = use_ssl if use_ssl is not None else os.getenv("WINRM_USE_SSL", "").lower() in (
            "1",
            "true",
            "yes",
        )

        scheme = "https" if self.use_ssl else "http"
        endpoint = f"{scheme}://{host}:{self.port}/wsman"

        try:
            self.protocol = Protocol(
                endpoint=endpoint,
                transport=os.getenv("WINRM_TRANSPORT", "ntlm"),
                username=username,
                password=password,
                server_cert_validation="ignore" if self.use_ssl else "validate",
            )
            print(f"[WinRM] Protocol initialized successfully for {endpoint}")
        except Exception as e:
            print(f"[WinRM ERROR] Failed to initialize Protocol: {str(e)}")
            traceback.print_exc()
            raise

        self.shell_id: str | None = None
        self.command_id: str | None = None
        self._output_queue: queue.Queue[str] = queue.Queue()
        self._reader_thread: threading.Thread | None = None
        self._closed = False
        self._error: str | None = None

    @property
    def error(self) -> str | None:
        return self._error

    def connect(self) -> None:
        try:
            print(f"[WinRM] Attempting to connect to {self.host}:{self.port}...")
            self.shell_id = self.protocol.open_shell()
            print(f"[WinRM] Shell opened successfully. Shell ID: {self.shell_id}")
            
            self.command_id = self.protocol.run_command(self.shell_id, "cmd.exe", ["/Q"])
            print(f"[WinRM] Command started successfully. Command ID: {self.command_id}")
            
            self._reader_thread = threading.Thread(target=self._poll_output, daemon=True)
            self._reader_thread.start()
            print("[WinRM] Output reader thread started")
        except Exception as e:
            print(f"[WinRM ERROR] Connection failed: {str(e)}")
            print(f"[WinRM ERROR] Error type: {type(e).__name__}")
            print(f"[WinRM ERROR] Full traceback:")
            traceback.print_exc()
            raise

    def _poll_output(self) -> None:
        assert self.shell_id is not None
        assert self.command_id is not None

        while not self._closed:
            try:
                stdout_bytes, stderr_bytes, status = self.protocol.get_command_output(
                    self.shell_id, self.command_id
                )
                if stdout_bytes:
                    self._output_queue.put(
                        stdout_bytes.decode("utf-8", errors="replace")
                    )
                if stderr_bytes:
                    self._output_queue.put(
                        stderr_bytes.decode("utf-8", errors="replace")
                    )
                if status is not None:
                    break
                time.sleep(0.05)
            except Exception as exc:
                error_msg = str(exc)
                self._error = error_msg
                print(f"[WinRM ERROR] Output polling failed: {error_msg}")
                print(f"[WinRM ERROR] Error type: {type(exc).__name__}")
                traceback.print_exc()
                break

    def read_output(self, timeout: float = 0.1) -> str | None:
        try:
            return self._output_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def send_input(self, data: str) -> None:
        if self._closed or not self.shell_id or not self.command_id:
            return
        try:
            # Ensure input ends with newline for proper command execution
            if not data.endswith('\r\n'):
                data += '\r\n'
            self.protocol.send_command_input(
                self.shell_id, self.command_id, data.encode("utf-8")
            )
        except Exception as e:
            print(f"[WinRM ERROR] Failed to send input: {str(e)}")
            traceback.print_exc()

    def close(self) -> None:
        self._closed = True
        if self.shell_id and self.command_id:
            try:
                self.protocol.cleanup_command(self.shell_id, self.command_id)
                print("[WinRM] Command cleaned up successfully")
            except Exception as e:
                print(f"[WinRM ERROR] Failed to cleanup command: {str(e)}")
        if self.shell_id:
            try:
                self.protocol.close_shell(self.shell_id)
                print("[WinRM] Shell closed successfully")
            except Exception as e:
                print(f"[WinRM ERROR] Failed to close shell: {str(e)}")


def stream_session(
    session: WinRMSession,
    on_output: Callable[[str], None],
    stop_event: threading.Event,
) -> None:
    """Forward session output to callback until stop_event is set."""
    while not stop_event.is_set() and not session._closed:
        if session.error:
            on_output(f"\r\n[session error] {session.error}\r\n")
            break
        chunk = session.read_output(timeout=0.15)
        if chunk:
            on_output(chunk)
        elif session._reader_thread and not session._reader_thread.is_alive():
            if session.error:
                on_output(f"\r\n[session error] {session.error}\r\n")
            break
