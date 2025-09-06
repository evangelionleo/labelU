import argparse
import json
import socket
import sys
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

try:
    import requests
except ImportError:
    requests = None  # type: ignore


DEFAULT_TIMEOUT_SECONDS: float = 3.0


@dataclass
class HttpCheck:
    method: str
    path: str


HTTP_CHECKS_BY_PORT = {
    5001: [
        HttpCheck('GET', '/api/health'),
        HttpCheck('GET', '/'),
    ],
    5002: [
        HttpCheck('GET', '/api/health'),
        HttpCheck('GET', '/'),
    ],
}


def tcp_connect(host: str, port: int, timeout: float) -> Tuple[bool, Optional[str]]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    start = time.time()
    try:
        sock.connect((host, port))
        elapsed = (time.time() - start) * 1000
        return True, f"TCP OK ({elapsed:.1f} ms)"
    except Exception as e:
        return False, f"TCP FAIL: {e}"
    finally:
        try:
            sock.close()
        except Exception:
            pass


def http_check(host: str, port: int, check: HttpCheck, timeout: float) -> Tuple[bool, str, Optional[int], Optional[str]]:
    if requests is None:
        return False, 'requests not installed', None, None

    url = f"http://{host}:{port}{check.path}"
    try:
        start = time.time()
        resp = requests.request(check.method, url, timeout=timeout)
        elapsed = (time.time() - start) * 1000
        # Try parse JSON body for diagnostics, but keep short
        body_snippet: Optional[str] = None
        ctype = resp.headers.get('Content-Type', '')
        if 'application/json' in ctype:
            try:
                body = resp.json()
                body_snippet = json.dumps(body)[:300]
            except Exception:
                body_snippet = resp.text[:300]
        else:
            body_snippet = resp.text[:200]

        ok = resp.ok
        msg = f"HTTP {check.method} {check.path} -> {resp.status_code} ({elapsed:.1f} ms)"
        return ok, msg, resp.status_code, body_snippet
    except Exception as e:
        return False, f"HTTP {check.method} {check.path} error: {e}", None, None


def run_checks(host: str, ports: List[int], timeout: float) -> int:
    overall_ok = True
    print(f"Target host: {host}")
    print(f"Timeout: {timeout:.1f}s")
    print()

    for port in ports:
        print(f"=== Port {port} ===")
        ok, msg = tcp_connect(host, port, timeout)
        print(msg)
        if not ok:
            overall_ok = False
            print()
            continue

        checks = HTTP_CHECKS_BY_PORT.get(port, [HttpCheck('GET', '/')])
        for check in checks:
            h_ok, h_msg, status, body = http_check(host, port, check, timeout)
            print(h_msg)
            if status is not None and body is not None:
                # Show small snippet for diagnostics
                snippet = body.replace('\n', ' ')[:180]
                print(f"  Body: {snippet}")
            if not h_ok:
                overall_ok = False
        print()

    return 0 if overall_ok else 1


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Probe AI services on ports 5001 and 5002.')
    parser.add_argument('--host', default='127.0.0.1', help='Target host or IP (default: 127.0.0.1)')
    parser.add_argument('--timeout', type=float, default=DEFAULT_TIMEOUT_SECONDS, help='Per-request timeout seconds (default: 3.0)')
    parser.add_argument('--ports', type=str, default='5001,5002', help='Comma-separated ports to test (default: 5001,5002)')
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args(sys.argv[1:])
    try:
        ports = [int(p.strip()) for p in args.ports.split(',') if p.strip()]
    except ValueError:
        print('Invalid --ports value, must be comma-separated integers', file=sys.stderr)
        return 2

    if requests is None:
        print('Python package "requests" not installed. Install with: pip install requests', file=sys.stderr)

    return run_checks(args.host, ports, args.timeout)


if __name__ == '__main__':
    sys.exit(main())


