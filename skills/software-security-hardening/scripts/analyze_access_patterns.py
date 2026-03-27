#!/usr/bin/env python3
"""Detect brute-force and DDoS-like patterns in HTTP access logs."""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

LOG_RE = re.compile(
    r'^(?P<ip>\S+) \S+ \S+ \[(?P<ts>[^\]]+)\] "(?P<method>[A-Z]+) (?P<path>[^" ]+)[^"]*" (?P<status>\d{3}) (?P<size>\S+)'
)
AUTH_PATH_HINTS = ("/login", "/signin", "/auth", "/token", "/oauth")
AUTH_FAIL_STATUSES = {401, 403, 429}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze access logs for abuse patterns.")
    parser.add_argument("--log-file", required=True, help="Path to access log")
    parser.add_argument("--bruteforce-failures", type=int, default=20, help="Auth failures threshold per IP")
    parser.add_argument("--ddos-rpm", type=int, default=600, help="Requests/min threshold per IP")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Output format")
    parser.add_argument("--output", help="Write JSON report to file")
    parser.add_argument("--top", type=int, default=20, help="Top talkers to include")
    parser.add_argument("--fail-on-findings", action="store_true", help="Exit with code 2 if findings exist")
    return parser.parse_args()


def parse_timestamp(value: str) -> datetime | None:
    formats = ["%d/%b/%Y:%H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def parse_line(line: str) -> dict[str, object] | None:
    match = LOG_RE.match(line.strip())
    if not match:
        return None

    ts = parse_timestamp(match.group("ts"))
    if ts is None:
        return None

    return {
        "ip": match.group("ip"),
        "ts": ts,
        "method": match.group("method"),
        "path": match.group("path"),
        "status": int(match.group("status")),
    }


def minute_bucket(ts: datetime) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M")


def detect_findings(
    requests_by_ip: dict[str, int],
    auth_failures_by_ip: dict[str, int],
    per_minute_by_ip: dict[str, dict[str, int]],
    bruteforce_threshold: int,
    ddos_rpm_threshold: int,
) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []

    ips = set(requests_by_ip) | set(auth_failures_by_ip) | set(per_minute_by_ip)
    for ip in sorted(ips):
        failed_auth = auth_failures_by_ip.get(ip, 0)
        rpm_peak = max(per_minute_by_ip.get(ip, {"": 0}).values()) if per_minute_by_ip.get(ip) else 0

        if failed_auth >= bruteforce_threshold:
            severity = "critical" if failed_auth >= bruteforce_threshold * 2 else "high"
            findings.append(
                {
                    "type": "BRUTE_FORCE",
                    "severity": severity,
                    "ip": ip,
                    "auth_failures": failed_auth,
                    "threshold": bruteforce_threshold,
                    "evidence": f"{failed_auth} failed auth attempts",
                }
            )

        if rpm_peak >= ddos_rpm_threshold:
            severity = "critical" if rpm_peak >= ddos_rpm_threshold * 2 else "high"
            findings.append(
                {
                    "type": "DDOS",
                    "severity": severity,
                    "ip": ip,
                    "rpm_peak": rpm_peak,
                    "threshold": ddos_rpm_threshold,
                    "evidence": f"{rpm_peak} requests in one minute",
                }
            )

    return findings


def severity_summary(findings: list[dict[str, object]]) -> dict[str, int]:
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for finding in findings:
        sev = str(finding.get("severity", "low"))
        summary[sev] = summary.get(sev, 0) + 1
    return summary


def print_text(report: dict[str, object]) -> None:
    summary = report["summary"]
    print(f"Lines parsed: {summary['parsed_lines']}")
    print(f"Unique IPs: {summary['unique_ips']}")
    print(f"Findings: {summary['total_findings']}")

    sev = summary["severity"]
    print(
        "Severity counts: "
        f"critical={sev.get('critical', 0)} "
        f"high={sev.get('high', 0)} "
        f"medium={sev.get('medium', 0)} "
        f"low={sev.get('low', 0)}"
    )

    top_ips = report["top_ips"]
    if top_ips:
        print("\nTop IPs by request volume:")
        for item in top_ips:
            print(f"- {item['ip']}: {item['requests']} requests")

    findings = report["findings"]
    if findings:
        print("\nFindings:")
        for finding in findings:
            if finding["type"] == "BRUTE_FORCE":
                print(
                    f"- [{finding['severity']}] BRUTE_FORCE ip={finding['ip']} "
                    f"failures={finding['auth_failures']}"
                )
            elif finding["type"] == "DDOS":
                print(
                    f"- [{finding['severity']}] DDOS ip={finding['ip']} rpm_peak={finding['rpm_peak']}"
                )


def main() -> int:
    args = parse_args()
    path = Path(args.log_file)
    if not path.exists():
        print(f"Log file not found: {path}")
        return 1

    requests_by_ip: dict[str, int] = defaultdict(int)
    auth_failures_by_ip: dict[str, int] = defaultdict(int)
    per_minute_by_ip: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    parsed_lines = 0
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        record = parse_line(raw_line)
        if record is None:
            continue

        parsed_lines += 1
        ip = str(record["ip"])
        req_path = str(record["path"]).lower()
        status = int(record["status"])
        ts = record["ts"]

        requests_by_ip[ip] += 1
        per_minute_by_ip[ip][minute_bucket(ts)] += 1

        if any(hint in req_path for hint in AUTH_PATH_HINTS) and status in AUTH_FAIL_STATUSES:
            auth_failures_by_ip[ip] += 1

    findings = detect_findings(
        requests_by_ip=requests_by_ip,
        auth_failures_by_ip=auth_failures_by_ip,
        per_minute_by_ip=per_minute_by_ip,
        bruteforce_threshold=args.bruteforce_failures,
        ddos_rpm_threshold=args.ddos_rpm,
    )

    top_ips = [
        {"ip": ip, "requests": count}
        for ip, count in sorted(requests_by_ip.items(), key=lambda item: item[1], reverse=True)[: args.top]
    ]

    report = {
        "tool": "analyze_access_patterns",
        "source": str(path.resolve()),
        "summary": {
            "parsed_lines": parsed_lines,
            "unique_ips": len(requests_by_ip),
            "total_findings": len(findings),
            "severity": severity_summary(findings),
        },
        "top_ips": top_ips,
        "findings": findings,
    }

    if args.format == "json":
        print(json.dumps(report, indent=2))
    else:
        print_text(report)

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.fail_on_findings and findings:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
