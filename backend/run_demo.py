#!/usr/bin/env python3
"""
SurakshaSetu Micro-Insurance Assistant - Hackathon Pitch Demo Launcher.

Detects and displays the laptop's local Wi-Fi IP address and starts Uvicorn
on 0.0.0.0:8000 so the app can be opened and tested live on a smartphone
during the hackathon presentation.

Usage:
    python3 run_demo.py            # Starts live server on 0.0.0.0:8000
    python3 run_demo.py --dry-run  # Discovers and prints IP without starting server
"""

import os
import re
import socket
import subprocess
import sys
from pathlib import Path


def get_local_ip() -> str:
    """
    Detects the laptop's primary local Wi-Fi or LAN IP address
    using multiple robust platform techniques.
    """
    # Technique 1: Parse ifconfig for active non-loopback inet interface
    try:
        out = subprocess.check_output(["ifconfig"], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("inet ") and not line.startswith("inet 127."):
                parts = line.split()
                if len(parts) >= 2:
                    candidate = parts[1]
                    # Filter out link-local 169.254.x.x
                    if not candidate.startswith("169.254."):
                        return candidate
    except Exception:
        pass

    # Technique 2: macOS ipconfig getifaddr en0 (Wi-Fi) or en1
    for iface in ["en0", "en1", "eth0", "wlan0"]:
        try:
            out = subprocess.check_output(
                ["ipconfig", "getifaddr", iface],
                text=True,
                stderr=subprocess.DEVNULL
            ).strip()
            if out and not out.startswith("127.") and not out.startswith("169.254."):
                return out
        except Exception:
            pass

    # Technique 3: UDP dummy socket connection to public IP (no packets sent)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
            return ip
    except Exception:
        pass

    # Technique 4: Hostname lookup
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    return "127.0.0.1"


def print_banner(local_ip: str, port: int = 8000) -> None:
    """Prints terminal banner with mobile Wi-Fi URLs."""
    divider = "=" * 70
    subdivider = "-" * 70

    print("\n" + divider)
    print("  🛡️  SURAKSHA SETU - MICRO-INSURANCE ASSISTANT")
    print("      Hackathon Live Demo & Mobile Pitch Gateway")
    print(divider)
    print(f"  Laptop Wi-Fi IP Address : {local_ip}")
    print(f"  Listening Interface     : 0.0.0.0:{port}")
    print(subdivider)
    print("  ACCESS URLS:")
    print(f"  📱 Smartphone (Same Wi-Fi) : http://{local_ip}:{port}")
    print(f"  💻 Laptop Local Browser    : http://localhost:{port}")
    print(f"  📑 Interactive API Docs    : http://{local_ip}:{port}/docs")
    print(f"  📊 Insurer Review Queue    : http://{local_ip}:{port}/api/claims")
    print(f"  🧪 Interactive Demo Samples: http://{local_ip}:{port}/api/samples")
    print(subdivider)
    print("  💡 HACKATHON PITCH TIP:")
    print(f"     1. Connect your smartphone to the SAME Wi-Fi network as this laptop.")
    print(f"     2. Open http://{local_ip}:{port} on your mobile browser (Safari/Chrome).")
    print(f"     3. Take photos of bills or test demo cases live on stage!")
    print(divider + "\n")


def start_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    """Launches the Uvicorn ASGI server."""
    backend_dir = str(Path(__file__).resolve().parent)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    try:
        import uvicorn
        uvicorn.run("server:app", host=host, port=port, reload=True, app_dir=backend_dir)
    except ImportError:
        # Fallback to python -m uvicorn subprocess
        cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "server:app",
            "--host",
            host,
            "--port",
            str(port),
            "--reload",
            "--app-dir",
            backend_dir,
        ]
        try:
            subprocess.run(cmd, cwd=backend_dir)
        except KeyboardInterrupt:
            print("\nShutting down SurakshaSetu server gracefully.")
            sys.exit(0)


def main():
    port = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])

    local_ip = get_local_ip()
    print_banner(local_ip, port=port)

    if "--dry-run" in sys.argv or "--check-only" in sys.argv:
        print("[DRY-RUN] Network configuration verified successfully. Exiting without binding port.")
        sys.exit(0)

    start_server(host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
