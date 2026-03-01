"""
Q-SHIELD — Behavioral Risk Engine
===================================
Weighted scoring engine that combines:
  - Login behavioral signals
  - URL structural analysis
  - Email NLP/keyword analysis
  - Quantum anomaly score

Output: Unified risk score (0–100), severity, explanation, recommended action
"""

import re
import time
import urllib.parse
from typing import Optional
import tldextract
import structlog

logger = structlog.get_logger("qshield.risk_engine")

# ─── Risk Weight Table ────────────────────────────────────────
WEIGHTS = {
    # Login signals
    "new_location":          25,
    "new_device":            20,
    "odd_login_time":        15,
    "suspicious_ip":         30,
    "multiple_failed_login": 20,
    "vpn_tor_exit":          35,
    # URL signals
    "suspicious_url_structure": 35,
    "url_shortener":         30,
    "ip_in_url":             40,
    "typosquatting":         45,
    "mismatched_ssl":        30,
    "phishing_keywords_url": 25,
    "excessive_subdomains":  20,
    # Email signals
    "email_phishing_keywords": 25,
    "urgent_language":       20,
    "credential_harvest":    35,
    "financial_lure":        30,
    "spoofed_sender":        40,
    "suspicious_attachment": 35,
    # Quantum bonus
    "quantum_anomaly_high":  20,
    "quantum_anomaly_critical": 35,
}

# ─── Threat Keywords ─────────────────────────────────────────
PHISHING_URL_KEYWORDS = [
    "login", "verify", "secure", "account", "update", "confirm",
    "banking", "password", "credential", "signin", "auth", "validate",
    "suspended", "unlock", "reactivate", "urgent", "alert",
]

PHISHING_EMAIL_KEYWORDS = {
    "urgency":    ["urgent", "immediately", "asap", "right now", "action required", "warning"],
    "financial":  ["prize", "winner", "lottery", "million", "reward", "refund", "wire transfer"],
    "credential": ["password", "username", "login", "verify", "confirm", "otp", "pin", "cvv"],
    "threat":     ["suspended", "terminated", "deleted", "blocked", "restricted", "unauthorized"],
}

URL_SHORTENERS = [
    "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "t.co", "buff.ly",
    "adf.ly", "tiny.cc", "is.gd", "cli.gs", "yfrog.com", "migre.me",
]

SUSPICIOUS_TLDS = [
    ".xyz", ".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".work",
    ".click", ".download", ".stream", ".review", ".loan",
]

LEGITIMATE_DOMAINS = [
    "google.com", "microsoft.com", "apple.com", "amazon.com",
    "github.com", "stackoverflow.com", "wikipedia.org",
]


def classify_severity(score: float) -> tuple[str, str]:
    """Return (severity_label, color_code)"""
    if score <= 25:
        return "LOW", "#00ff88"
    elif score <= 50:
        return "MEDIUM", "#ffd60a"
    elif score <= 75:
        return "HIGH", "#ff6b00"
    else:
        return "CRITICAL", "#ff2d55"


def get_recommended_action(severity: str, event_type: str) -> str:
    actions = {
        "LOW": "Monitor activity. No immediate action required.",
        "MEDIUM": "Review flagged activity. Consider enabling 2FA if not active.",
        "HIGH": "Alert user immediately. Temporarily restrict account access.",
        "CRITICAL": "Block access immediately. Notify security administrator. Initiate incident response.",
    }
    return actions.get(severity, "Review and take appropriate action.")


# ─── URL Risk Analysis ────────────────────────────────────────

def analyze_url(url: str) -> dict:
    """
    Analyze a URL for phishing/malicious indicators.
    Returns: risk_score, severity, flags, explanation, quantum_features
    """
    flags = []
    score = 0
    quantum_features = {}

    try:
        parsed = urllib.parse.urlparse(url)
        ext = tldextract.extract(url)
        domain = f"{ext.domain}.{ext.suffix}"
        full_domain = parsed.netloc.lower()
    except Exception:
        return _build_result(100, ["CRITICAL: Malformed URL"], {}, url, "url_scan")

    # IP-based URL
    ip_pattern = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
    if ip_pattern.match(parsed.netloc.split(":")[0]):
        score += WEIGHTS["ip_in_url"]
        flags.append(f"IP address used as host (+{WEIGHTS['ip_in_url']}): Bypasses DNS trust")
        quantum_features["uses_ip"] = 1

    # URL shortener
    for shortener in URL_SHORTENERS:
        if shortener in full_domain:
            score += WEIGHTS["url_shortener"]
            flags.append(f"URL shortener detected (+{WEIGHTS['url_shortener']}): Masks true destination")
            quantum_features["url_shortener"] = 1
            break

    # Suspicious TLD
    for tld in SUSPICIOUS_TLDS:
        if url.lower().endswith(tld) or f"{tld}/" in url.lower():
            score += 25
            flags.append(f"High-risk TLD '{tld}' (+25): Commonly abused in phishing")
            quantum_features["suspicious_tld"] = 1
            break

    # Excessive subdomains (typosquatting)
    subdomain_parts = ext.subdomain.split(".") if ext.subdomain else []
    if len(subdomain_parts) > 3:
        score += WEIGHTS["excessive_subdomains"]
        flags.append(f"Excessive subdomains (+{WEIGHTS['excessive_subdomains']}): Obfuscation attempt")
        quantum_features["excessive_subdomains"] = 1

    # Typosquatting detection (simple)
    for legit in LEGITIMATE_DOMAINS:
        legit_name = legit.split(".")[0]
        if legit_name in domain.lower() and domain.lower() != legit:
            score += WEIGHTS["typosquatting"]
            flags.append(f"Possible typosquatting of '{legit}' (+{WEIGHTS['typosquatting']})")
            quantum_features["typosquatting"] = 1
            break

    # Phishing keywords in URL path
    path_lower = (parsed.path + "?" + parsed.query).lower()
    keyword_hits = [kw for kw in PHISHING_URL_KEYWORDS if kw in path_lower]
    if len(keyword_hits) >= 2:
        score += WEIGHTS["phishing_keywords_url"]
        flags.append(f"Phishing keywords in URL (+{WEIGHTS['phishing_keywords_url']}): {', '.join(keyword_hits[:3])}")
        quantum_features["phishing_keywords"] = 1

    # HTTP (not HTTPS)
    if parsed.scheme == "http":
        score += 15
        flags.append("+15: Non-HTTPS URL — unencrypted connection")
        quantum_features["https_mismatch"] = 1

    # @ symbol in URL
    if "@" in url:
        score += 20
        flags.append("+20: '@' symbol in URL — browser redirects after '@'")
        quantum_features["at_symbol"] = 1

    # Very long URL
    if len(url) > 150:
        score += 10
        flags.append(f"+10: Unusually long URL ({len(url)} chars) — possible obfuscation")

    score = min(score, 100)
    return _build_result(score, flags, quantum_features, url, "url_scan")


# ─── Email Risk Analysis ──────────────────────────────────────

def analyze_email(content: str, subject: str = "", sender: str = "") -> dict:
    """
    Analyze email content for phishing indicators.
    """
    flags = []
    score = 0
    quantum_features = {}
    text = f"{subject} {content}".lower()

    # Urgency keywords
    urgency_hits = [w for w in PHISHING_EMAIL_KEYWORDS["urgency"] if w in text]
    if urgency_hits:
        score += WEIGHTS["urgent_language"]
        flags.append(f"Urgency language (+{WEIGHTS['urgent_language']}): {', '.join(urgency_hits[:3])}")
        quantum_features["urgency_keywords"] = 1

    # Financial lure
    financial_hits = [w for w in PHISHING_EMAIL_KEYWORDS["financial"] if w in text]
    if financial_hits:
        score += WEIGHTS["financial_lure"]
        flags.append(f"Financial lure (+{WEIGHTS['financial_lure']}): {', '.join(financial_hits[:3])}")
        quantum_features["financial_keywords"] = 1

    # Credential harvesting
    cred_hits = [w for w in PHISHING_EMAIL_KEYWORDS["credential"] if w in text]
    if len(cred_hits) >= 2:
        score += WEIGHTS["credential_harvest"]
        flags.append(f"Credential harvesting attempt (+{WEIGHTS['credential_harvest']}): {', '.join(cred_hits[:4])}")
        quantum_features["credential_keywords"] = 1

    # Threat keywords
    threat_hits = [w for w in PHISHING_EMAIL_KEYWORDS["threat"] if w in text]
    if threat_hits:
        score += 25
        flags.append(f"Threat/scare language (+25): {', '.join(threat_hits[:3])}")
        quantum_features["threat_keywords"] = 1

    # Suspicious sender domain
    if sender:
        sender_lower = sender.lower()
        if any(bad in sender_lower for bad in ["noreply@", "support@", "security@"]):
            # These are common in phishing
            score += 10
            flags.append("+10: Generic sender alias commonly used in phishing")
            quantum_features["suspicious_sender"] = 1

    # Click here / link detection
    if "click here" in text or "click the link" in text:
        score += 20
        flags.append("+20: 'Click here' directive — classic phishing call-to-action")

    # Multiple external links
    link_count = len(re.findall(r"https?://", text))
    if link_count > 3:
        score += 15
        flags.append(f"+15: {link_count} external URLs detected")
        quantum_features["external_links"] = 1

    # HTML obfuscation indicators
    if re.search(r"&#\d+;|%[0-9a-fA-F]{2}", content):
        score += 20
        flags.append("+20: HTML/URL encoding detected — possible obfuscation")
        quantum_features["html_obfuscation"] = 1

    # Attachment risk words
    if re.search(r"\.(exe|zip|rar|doc|docm|xlsm)\b", text):
        score += WEIGHTS["suspicious_attachment"]
        flags.append(f"Risky attachment type (+{WEIGHTS['suspicious_attachment']})")
        quantum_features["attachment_risk"] = 1

    score = min(score, 100)
    return _build_result(score, flags, quantum_features, f"Email: {subject[:50]}", "email_scan")


# ─── Login Risk Analysis ──────────────────────────────────────

def analyze_login(metadata: dict, baseline: Optional[dict] = None) -> dict:
    """
    Analyze login event for behavioral anomalies.
    """
    flags = []
    score = 0
    quantum_features = {}
    hour = metadata.get("login_hour", 12)

    # New location
    if metadata.get("new_location"):
        score += WEIGHTS["new_location"]
        flags.append(f"New login location (+{WEIGHTS['new_location']}): {metadata.get('location', 'Unknown')}")
        quantum_features["new_location"] = 1

    # New device
    if metadata.get("new_device"):
        score += WEIGHTS["new_device"]
        flags.append(f"New device fingerprint (+{WEIGHTS['new_device']})")
        quantum_features["new_device"] = 1

    # Odd login time (outside 6am–11pm)
    if hour < 6 or hour > 23:
        score += WEIGHTS["odd_login_time"]
        flags.append(f"Unusual login time (+{WEIGHTS['odd_login_time']}): {hour:02d}:00 hrs")
        quantum_features["odd_login_time"] = 1

    # Suspicious IP
    if metadata.get("suspicious_ip"):
        score += WEIGHTS["suspicious_ip"]
        flags.append(f"Suspicious IP (+{WEIGHTS['suspicious_ip']}): {metadata.get('ip')}")
        quantum_features["suspicious_ip"] = 1

    # VPN / Tor
    if metadata.get("vpn_detected") or metadata.get("tor_exit"):
        score += WEIGHTS["vpn_tor_exit"]
        flags.append(f"VPN/Tor exit node (+{WEIGHTS['vpn_tor_exit']}): Anonymized connection")

    # Multiple failed logins
    failed = metadata.get("failed_attempts", 0)
    if failed >= 3:
        score += WEIGHTS["multiple_failed_login"]
        flags.append(f"Multiple failed attempts (+{WEIGHTS['multiple_failed_login']}): {failed} failures")

    score = min(score, 100)
    return _build_result(score, flags, quantum_features, metadata.get("ip", ""), "login_analysis")


# ─── Unified Result Builder ───────────────────────────────────

def _build_result(
    score: float,
    flags: list,
    quantum_features: dict,
    indicator: str,
    event_type: str,
) -> dict:
    severity, color = classify_severity(score)
    action = get_recommended_action(severity, event_type)

    return {
        "risk_score": round(score, 2),
        "severity": severity,
        "severity_color": color,
        "explanation": flags,
        "recommended_action": action,
        "event_type": event_type,
        "threat_indicator": indicator[:500],
        "quantum_features": quantum_features,
        "timestamp": time.time(),
    }
