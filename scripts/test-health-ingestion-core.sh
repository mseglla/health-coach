#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v swiftc >/dev/null || { echo 'Cal swiftc (Xcode Command Line Tools).'; exit 1; }
atles_test_dir=$(mktemp -d)
trap 'rm -f "$atles_test_dir/health-ingestion-tests"; rmdir "$atles_test_dir"' EXIT
swiftc -swift-version 5 -parse-as-library \
  ios/ATLESConnector/ATLESConnector/HealthIngestionCore.swift \
  tests/HealthIngestionCoreTests.swift \
  -o "$atles_test_dir/health-ingestion-tests"
"$atles_test_dir/health-ingestion-tests"
