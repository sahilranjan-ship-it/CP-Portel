#!/bin/zsh
set -euo pipefail

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Running incremental graph update..."
  code-review-graph update
else
  echo "No git repository detected. Falling back to full graph build."
  code-review-graph build
fi
