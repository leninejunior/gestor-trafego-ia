#!/usr/bin/env python3
"""Scan a workspace for potentially exposed secrets."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Iterable

DEFAULT_EXCLUDES = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    ".venv",
    "venv",
    "__pycache__",
    ".turbo",
}

SECRET_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    (
        "AWS_ACCESS_KEY_ID",
        re.compile(r"\b(A3T[A-Z0-9]|AKIA|ASIA|AGPA|AIDA|ANPA)[A-Z0-9]{16}\b"),
        "critical",
    ),
    (
        "GITHUB_TOKEN",
        re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,255}\b"),
        "critical",
    ),
    (
        "SLACK_TOKEN",
        re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,200}\b"),
        "high",
    ),
    (
        "PRIVATE_KEY_BLOCK",
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----"),
        "critical",
    ),
    (
        "GENERIC_API_KEY_ASSIGNMENT",
        re.compile(
            r"(?i)\b(?:api|secret|token|password|passwd|client_secret|private_key)[\w.-]{0,24}\s*[:=]\s*['\"][A-Za-z0-9_\-/.+=]{16,}['\"]"
        ),
        "high",
    ),
]

ENTROPY_CANDIDATE_RE = re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/=]{32,}(?![A-Za-z0-9+/=])")
KEYWORD_HINT_RE = re.compile(
    r"(?i)\b(secret|token|api[_-]?key|password|passwd|private[_-]?key|client[_-]?secret|bearer)\b"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scan files for potentially exposed secrets.")
    parser.add_argument("--path", default=".", help="Directory to scan (default: current directory)")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Output format")
    parser.add_argument("--output", help="Write report to file")
    parser.add_argument("--max-file-size-kb", type=int, default=512, help="Maximum file size to scan")
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Path fragment to exclude (repeatable)",
    )
    parser.add_argument(
        "--fail-on-findings",
        action="store_true",
        help="Exit with code 2 when findings are present",
    )
    return parser.parse_args()


def shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: dict[str, int] = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    length = len(value)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def is_binary_blob(blob: bytes) -> bool:
    return b"\x00" in blob


def should_skip(path: Path, root: Path, excludes: set[str], max_size_bytes: int) -> bool:
    relative = str(path.relative_to(root))
    if any(part in excludes for part in path.parts):
        return True
    if any(fragment and fragment in relative for fragment in excludes):
        return True
    if path.is_file() and path.stat().st_size > max_size_bytes:
        return True
    return False


def iter_files(root: Path, excludes: set[str], max_size_bytes: int) -> Iterable[Path]:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if should_skip(path, root, excludes, max_size_bytes):
            continue
        yield path


def make_finding(
    file_path: Path,
    line_no: int,
    rule: str,
    severity: str,
    match_text: str,
) -> dict[str, object]:
    snippet = match_text.strip()
    if len(snippet) > 120:
        snippet = snippet[:117] + "..."
    return {
        "file": str(file_path),
        "line": line_no,
        "rule": rule,
        "severity": severity,
        "match": snippet,
    }


def scan_file(file_path: Path) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    blob = file_path.read_bytes()
    if is_binary_blob(blob):
        return findings

    text = blob.decode("utf-8", errors="ignore")
    lines = text.splitlines()

    for index, line in enumerate(lines, start=1):
        for rule, pattern, severity in SECRET_PATTERNS:
            for match in pattern.finditer(line):
                findings.append(
                    make_finding(
                        file_path=file_path,
                        line_no=index,
                        rule=rule,
                        severity=severity,
                        match_text=match.group(0),
                    )
                )

        # Heuristic: high-entropy token near secret-like keywords.
        if KEYWORD_HINT_RE.search(line):
            for candidate in ENTROPY_CANDIDATE_RE.findall(line):
                entropy = shannon_entropy(candidate)
                if entropy >= 4.2:
                    findings.append(
                        make_finding(
                            file_path=file_path,
                            line_no=index,
                            rule="HIGH_ENTROPY_SECRET_CANDIDATE",
                            severity="medium",
                            match_text=candidate,
                        )
                    )

    return findings


def serialize_report(findings: list[dict[str, object]], files_scanned: int, root: Path) -> dict[str, object]:
    severity_totals = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for finding in findings:
        severity = str(finding.get("severity", "low"))
        severity_totals[severity] = severity_totals.get(severity, 0) + 1

    return {
        "tool": "scan_exposed_secrets",
        "root": str(root),
        "summary": {
            "files_scanned": files_scanned,
            "total_findings": len(findings),
            "severity": severity_totals,
        },
        "findings": findings,
    }


def print_text_report(report: dict[str, object]) -> None:
    summary = report["summary"]
    severity = summary["severity"]
    print(f"Scanned files: {summary['files_scanned']}")
    print(f"Findings: {summary['total_findings']}")
    print(
        "Severity counts: "
        f"critical={severity.get('critical', 0)} "
        f"high={severity.get('high', 0)} "
        f"medium={severity.get('medium', 0)} "
        f"low={severity.get('low', 0)}"
    )

    findings = report["findings"]
    if findings:
        print("\nTop findings:")
        for finding in findings[:50]:
            print(
                f"- [{finding['severity']}] {finding['rule']} "
                f"{finding['file']}:{finding['line']} => {finding['match']}"
            )


def main() -> int:
    args = parse_args()
    root = Path(args.path).resolve()
    if not root.exists():
        print(f"Path not found: {root}")
        return 1

    excludes = set(DEFAULT_EXCLUDES)
    excludes.update(part.strip() for part in args.exclude if part.strip())
    max_size_bytes = args.max_file_size_kb * 1024

    findings: list[dict[str, object]] = []
    files_scanned = 0

    for file_path in iter_files(root, excludes=excludes, max_size_bytes=max_size_bytes):
        files_scanned += 1
        findings.extend(scan_file(file_path))

    report = serialize_report(findings=findings, files_scanned=files_scanned, root=root)

    if args.format == "json":
        serialized = json.dumps(report, indent=2)
        print(serialized)
    else:
        print_text_report(report)

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if args.fail_on_findings and findings:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
