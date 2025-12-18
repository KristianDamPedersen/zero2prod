#!/usr/bin/env bash
set -euo pipefail

export CARGO_HOME=/work/.cargo

cargo fmt --check
cargo clippy --all-features -- -D warnings
