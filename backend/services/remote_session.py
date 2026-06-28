"""Interactive remote command execution via net use + cmd pipes."""

from __future__ import annotations

import os
import queue
import subprocess
import threading
import time
import traceback
from typing import Callable


class RemoteSession:
    """Interactive remote command session via net use and cmd remoting."""

    def __init__(
        self,
        host: str,
        password: str,
        username: str = "Administrator",
        port: int | None = None,
    ) -> None:
        self.host = host
        self.username = username
        self.password = password
        self.port = port or 445  # SMB port

        self._output_queue: queue.Queue[str] = queue.Queue()
        self._process: subprocess.Popen | None = None
        self._reader_thread: threading.Thread | None = None
        self._closed = False
        self._error: str | None = None

    @property
    def error(self) -> str | None:
        return self._error

    def connect(self) -> None:
        """Establish connection to remote server."""
        try:
            print(f"[Remote] Attempting to connect to {self.host}...")
            
            # First, establish SMB connection via net use
            share = f"\\\\{self.host}\\C$"
            escaped_password = self.password.replace('"', '\\"')
            
            net_use_cmd = f'net use "{share}" /user:{self.username} "{escaped_password}"'
            print(f"[Remote] Authenticating with SMB share...")
            
            result = subprocess.run(
                net_use_cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=10,
            )
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                raise Exception(f"SMB authentication failed: {error_msg}")
            
            print(f"[Remote] SMB connection established")
            
            # Now create interactive PowerShell session via PsExec-like approach
            # Using psexec if available, otherwise fallback to cmd + wmic
            self._start_interactive_session()
            
        except Exception as e:
            print(f"[Remote ERROR] Connection failed: {str(e)}")
            print(f"[Remote ERROR] Error type: {type(e).__name__}")
            traceback.print_exc()
            raise

    def _start_interactive_session(self) -> None:
        """Start interactive command session."""
        try:
            # Use Windows' built-in remote command execution
            # This uses SMB instead of WinRM/WinRS
            cmd = f'psexec \\\\{self.host} -u {self.username} -p "{self.password}" cmd.exe'
            
            print(f"[Remote] Starting interactive session...")
            self._process = subprocess.Popen(
                cmd,
                shell=True,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            
            print(f"[Remote] Interactive session started (PID: {self._process.pid})")
            
            # Start reader thread
            self._reader_thread = threading.Thread(target=self._read_output, daemon=True)
            self._reader_thread.start()
            
        except Exception as e:
            print(f"[Remote ERROR] Failed to start session: {str(e)}")
            raise

    def _read_output(self) -> None:
        """Read output from remote process."""
        try:
            if not self._process or not self._process.stdout:
                return
            
            for line in iter(self._process.stdout.readline, ''):
                if not line:
                    break
                self._output_queue.put(line)
                if self._closed:
                    break
                    
        except Exception as exc:
            error_msg = str(exc)
            self._error = error_msg
            print(f"[Remote ERROR] Output reading failed: {error_msg}")
            traceback.print_exc()

    def read_output(self, timeout: float = 0.1) -> str | None:
        """Read queued output."""
        try:
            return self._output_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def send_input(self, data: str) -> None:
        """Send command to remote process."""
        if self._closed or not self._process or not self._process.stdin:
            return
        try:
            # Ensure input ends with newline
            if not data.endswith('\n'):
                data += '\n'
            self._process.stdin.write(data)
            self._process.stdin.flush()
            print(f"[Remote] Sent: {data.strip()}")
        except Exception as e:
            print(f"[Remote ERROR] Failed to send input: {str(e)}")

    def close(self) -> None:
        """Close remote session."""
        self._closed = True
        
        if self._process:
            try:
                self._process.stdin.write("exit\n")
                self._process.stdin.flush()
                self._process.wait(timeout=5)
                print("[Remote] Process closed successfully")
            except Exception as e:
                print(f"[Remote ERROR] Failed to close process: {str(e)}")
                try:
                    self._process.kill()
                except:
                    pass


def stream_session(
    session: RemoteSession,
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
        elif session._process and session._process.poll() is not None:
            # Process has ended
            if session.error:
                on_output(f"\r\n[session error] {session.error}\r\n")
            break
