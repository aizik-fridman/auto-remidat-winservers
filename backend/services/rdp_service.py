"""Generate Remote Desktop (.rdp) file content for a target server."""

from __future__ import annotations

import base64
import sys


def _encode_rdp_password(password: str, username: str) -> str | None:
    """Encode password for RDP file using Windows CryptProtectData (Windows only)."""
    if sys.platform != "win32":
        return None

    try:
        import ctypes
        from ctypes import wintypes

        class DATA_BLOB(ctypes.Structure):
            _fields_ = [
                ("cbData", wintypes.DWORD),
                ("pbData", ctypes.POINTER(ctypes.c_byte)),
            ]

        crypt32 = ctypes.windll.crypt32
        kernel32 = ctypes.windll.kernel32

        entropy = f"{username}Password".encode("utf-16-le")
        password_bytes = password.encode("utf-16-le")

        in_blob = DATA_BLOB()
        in_blob.cbData = len(password_bytes)
        in_blob.pbData = ctypes.cast(
            ctypes.create_string_buffer(password_bytes), ctypes.POINTER(ctypes.c_byte)
        )

        entropy_blob = DATA_BLOB()
        entropy_blob.cbData = len(entropy)
        entropy_blob.pbData = ctypes.cast(
            ctypes.create_string_buffer(entropy), ctypes.POINTER(ctypes.c_byte)
        )

        out_blob = DATA_BLOB()
        if not crypt32.CryptProtectData(
            ctypes.byref(in_blob),
            None,
            ctypes.byref(entropy_blob),
            None,
            None,
            0,
            ctypes.byref(out_blob),
        ):
            return None

        encrypted = ctypes.string_at(out_blob.pbData, out_blob.cbData)
        kernel32.LocalFree(out_blob.pbData)
        return base64.b64encode(encrypted).decode("ascii")
    except Exception:
        return None


def generate_rdp_content(target_ip: str, password: str, username: str = "Administrator") -> str:
    lines = [
        "screen mode id:i:2",
        "use multimon:i:0",
        "desktopwidth:i:1920",
        "desktopheight:i:1080",
        "session bpp:i:32",
        "winposstr:s:0,1,0,0,800,600",
        "compression:i:1",
        "keyboardhook:i:2",
        "audiocapturemode:i:0",
        "videoplaybackmode:i:1",
        "connection type:i:7",
        "networkautodetect:i:1",
        "bandwidthautodetect:i:1",
        "displayconnectionbar:i:1",
        "enableworkspacereconnect:i:0",
        "disable wallpaper:i:0",
        "allow font smoothing:i:0",
        "allow desktop composition:i:0",
        "disable full window drag:i:1",
        "disable menu anims:i:1",
        "disable themes:i:0",
        "disable cursor setting:i:0",
        "bitmapcachepersistenable:i:1",
        f"full address:s:{target_ip}",
        "audiomode:i:0",
        "redirectprinters:i:1",
        "redirectcomports:i:0",
        "redirectsmartcards:i:1",
        "redirectclipboard:i:1",
        "redirectposdevices:i:0",
        "autoreconnection enabled:i:1",
        "authentication level:i:2",
        "prompt for credentials:i:0",
        "negotiate security layer:i:1",
        "remoteapplicationmode:i:0",
        "alternate shell:s:",
        "shell working directory:s:",
        "gatewayhostname:s:",
        "gatewayusagemethod:i:4",
        "gatewaycredentialssource:i:4",
        "gatewayprofileusagemethod:i:0",
        "promptcredentialonce:i:0",
        "use redirection server name:i:0",
        f"username:s:{username}",
    ]

    encoded_password = _encode_rdp_password(password, username)
    if encoded_password:
        lines.append(f"password 51:b:{encoded_password}")

    return "\r\n".join(lines) + "\r\n"
