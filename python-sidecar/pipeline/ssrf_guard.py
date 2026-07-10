"""SSRF guard for sidecar fetches of user-supplied URLs."""
import ipaddress
import socket
from urllib.parse import urlparse


def _is_private_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True
    if ip.version == 4 and ipaddress.ip_address("100.64.0.0") <= ip <= ipaddress.ip_address("100.127.255.255"):
        return True
    return False


def assert_public_url(raw_url: str) -> None:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Only http(s) URLs are allowed")

    host = parsed.hostname.strip("[]").lower()
    if host == "localhost" or host.endswith(".localhost"):
        raise ValueError("Blocked host")

    try:
        if _is_private_address(host):
            raise ValueError("Blocked private address")
        return
    except ValueError as exc:
        if str(exc).startswith("Blocked"):
            raise

    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("DNS resolution failed") from exc

    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise ValueError("DNS resolution failed")
    for address in addresses:
        if _is_private_address(address):
            raise ValueError("Blocked private address")
