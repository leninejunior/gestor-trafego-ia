#!/usr/bin/env python3
"""Aggregate security reports and enforce release gates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SEVERITY_ORDER = ("critical", "high", "medium", "low")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aggregate report files and apply severity thresholds.")
    parser.add_argument("--report", action="append", required=True, help="JSON report path (repeatable)")
    parser.add_argument("--max-critical", type=int, default=0, help="Allowed critical findings")
    parser.add_argument("--max-high", type=int, default=0, help="Allowed high findings")
    parser.add_argument("--max-medium", type=int, default=3, help="Allowed medium findings")
    parser.add_argument("--max-low", type=int, default=9999, help="Allowed low findings")
    parser.add_argument("--max-findings", type=int, default=9999, help="Allowed total findings")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Output format")
    parser.add_argument("--output", help="Write JSON gate report to file")
    return parser.parse_args()


def normalize_severity(value: str) -> str:
    sev = value.lower().strip()
    if sev in SEVERITY_ORDER:
        return sev
    return "low"


def load_findings(report_path: Path) -> tuple[list[dict[str, object]], str | None]:
    try:
        payload = json.loads(report_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [], f"Failed to parse {report_path}: {exc}"

    findings = payload.get("findings", []) if isinstance(payload, dict) else []
    if not isinstance(findings, list):
        return [], f"Invalid findings list in {report_path}"

    normalized: list[dict[str, object]] = []
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        copy = dict(finding)
        copy["severity"] = normalize_severity(str(copy.get("severity", "low")))
        copy["source_report"] = str(report_path)
        normalized.append(copy)
    return normalized, None


def evaluate_gate(
    findings: list[dict[str, object]],
    max_critical: int,
    max_high: int,
    max_medium: int,
    max_low: int,
    max_findings: int,
) -> tuple[bool, dict[str, int], list[str]]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for finding in findings:
        sev = normalize_severity(str(finding.get("severity", "low")))
        counts[sev] = counts.get(sev, 0) + 1

    violations: list[str] = []
    if counts["critical"] > max_critical:
        violations.append(f"critical={counts['critical']} exceeds max-critical={max_critical}")
    if counts["high"] > max_high:
        violations.append(f"high={counts['high']} exceeds max-high={max_high}")
    if counts["medium"] > max_medium:
        violations.append(f"medium={counts['medium']} exceeds max-medium={max_medium}")
    if counts["low"] > max_low:
        violations.append(f"low={counts['low']} exceeds max-low={max_low}")
    if len(findings) > max_findings:
        violations.append(f"total={len(findings)} exceeds max-findings={max_findings}")

    return len(violations) == 0, counts, violations


def print_text(payload: dict[str, object]) -> None:
    print(f"Gate result: {payload['result']}")
    print(f"Reports: {payload['summary']['reports']}")
    print(f"Total findings: {payload['summary']['total_findings']}")

    counts = payload["summary"]["severity"]
    print(
        "Severity counts: "
        f"critical={counts.get('critical', 0)} "
        f"high={counts.get('high', 0)} "
        f"medium={counts.get('medium', 0)} "
        f"low={counts.get('low', 0)}"
    )

    violations = payload["violations"]
    if violations:
        print("Violations:")
        for item in violations:
            print(f"- {item}")


def main() -> int:
    args = parse_args()

    aggregated: list[dict[str, object]] = []
    errors: list[str] = []
    for raw_path in args.report:
        report_path = Path(raw_path)
        findings, error = load_findings(report_path)
        if error:
            errors.append(error)
            continue
        aggregated.extend(findings)

    passed, counts, violations = evaluate_gate(
        findings=aggregated,
        max_critical=args.max_critical,
        max_high=args.max_high,
        max_medium=args.max_medium,
        max_low=args.max_low,
        max_findings=args.max_findings,
    )

    if errors:
        violations.extend(errors)

    payload = {
        "tool": "security_gate",
        "result": "PASS" if passed and not errors else "FAIL",
        "summary": {
            "reports": len(args.report),
            "total_findings": len(aggregated),
            "severity": counts,
        },
        "violations": violations,
        "findings": aggregated,
    }

    if args.format == "json":
        print(json.dumps(payload, indent=2))
    else:
        print_text(payload)

    if args.output:
        Path(args.output).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    return 0 if payload["result"] == "PASS" else 3


if __name__ == "__main__":
    raise SystemExit(main())
