#!/usr/bin/env bash
set -euo pipefail

JOB_IMAGE="${1:?usage: run-job.sh <job-image> [-- <cmd...>]}"
shift || true

CMD=()
if [[ "${1:-}" == "--" ]]; then
  shift
  CMD=("$@")
fi

UIDGID="$(id -u):$(id -g)"

exec docker run --rm -t \
  -u "$UIDGID" \
  -v "$PWD:/work" \
  -w /work \
  "$JOB_IMAGE" "${CMD[@]}"
