#!/usr/bin/env bash
set -euo pipefail
source_dir=$(realpath "$1")
build_dir=$(realpath -m "$2")
adapter_dir=$(cd "$(dirname "$0")" && pwd)
expected=025f371dc76b598d77384fbdab90c937471844d8
test "$(git -C "$source_dir" rev-parse HEAD)" = "$expected"
test -z "$(git -C "$source_dir" status --porcelain)"
emcmake cmake -S "$adapter_dir" -B "$build_dir" -G Ninja \
  -DOPENCC_SOURCE_DIR="$source_dir" -DCMAKE_BUILD_TYPE=Release \
  -DPython3_EXECUTABLE="$(command -v python3)" \
  -DCMAKE_CXX_FLAGS=-fexceptions
cmake --build "$build_dir" --target opencc_browser -j 4
