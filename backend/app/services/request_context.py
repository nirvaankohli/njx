from __future__ import annotations

import re
from ipaddress import ip_address

from starlette.datastructures import Headers


COUNTRY_HEADERS = (
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
    "x-country-code",
    "x-country",
    "x-client-country",
)


def detect_country(headers: Headers) -> str | None:
    for name in COUNTRY_HEADERS:
        value = (headers.get(name) or "").strip().upper()
        if re.fullmatch(r"[A-Z]{2}", value) and value not in {"XX", "T1"}:
            return value
    return None


def detect_browser(user_agent: str | None) -> str:
    value = user_agent or ""
    patterns = (
        (r"(?:Edg|EdgiOS|EdgA)/([\d.]+)", "Edge"),
        (r"(?:OPR|Opera)/([\d.]+)", "Opera"),
        (r"(?:CriOS|Chrome)/([\d.]+)", "Chrome"),
        (r"FxiOS/([\d.]+)", "Firefox"),
        (r"Firefox/([\d.]+)", "Firefox"),
        (r"Version/([\d.]+).+Safari/", "Safari"),
    )
    for pattern, family in patterns:
        match = re.search(pattern, value, re.IGNORECASE)
        if match:
            return f"{family} {match.group(1).split('.')[0]}"
    if re.search(r"bot|crawler|spider|slurp", value, re.IGNORECASE):
        return "Bot"
    return "Unknown"


def detect_client_ip(headers: Headers, peer_ip: str | None) -> str | None:
    candidates = (
        headers.get("cf-connecting-ip"),
        headers.get("true-client-ip"),
        headers.get("x-real-ip"),
        (headers.get("x-forwarded-for") or "").split(",")[0],
        peer_ip,
        headers.get("x-client-ip"),
    )
    fallback = None
    for candidate in candidates:
        value = (candidate or "").strip()
        try:
            parsed = ip_address(value)
        except ValueError:
            continue
        fallback = fallback or str(parsed)
        if not (parsed.is_private or parsed.is_loopback or parsed.is_link_local):
            return str(parsed)
    return fallback
