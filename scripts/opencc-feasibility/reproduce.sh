#!/usr/bin/env bash
# Requires bootstrap.sh, host GCC/G++, curl, git, and standard Linux utilities.
set -euo pipefail
base=$(realpath -m "${1:?pass the dedicated WSL ext4 cache directory}")
root=$(cd "$(dirname "$0")" && pwd)
export PATH="$base/tools/python/cpython-3.13.9-linux-x86_64-gnu/bin:$base/tools/pytools/bin:$PATH"
export PYTHONPATH="$base/tools/pytools"
source "$base/tools/emsdk/emsdk_env.sh" >/dev/null 2>&1
test "$(python3 --version)" = 'Python 3.13.9'
test "$(cmake --version | head -1)" = 'cmake version 3.31.10'
test "$(ninja --version)" = '1.13.0.git.kitware.jobserver-pipe-1'
emcc --version | head -1 | grep -F '4.0.22'
mkdir -p "$base/source"
source_dir="$base/source/OpenCC"
if test ! -d "$source_dir/.git"; then git clone --branch ver.1.4.2 --depth 1 https://github.com/BYVoid/OpenCC.git "$source_dir"; fi
test "$(git -C "$source_dir" rev-parse HEAD)" = 025f371dc76b598d77384fbdab90c937471844d8
test -z "$(git -C "$source_dir" status --porcelain)"
wasm_build=${OPENCC_BUILD_DIR:-"$base/build"}
native_build=${OPENCC_NATIVE_BUILD_DIR:-"$base/native-build"}
bash "$root/adapter/build.sh" "$source_dir" "$wasm_build"
cmake -S "$source_dir" -B "$native_build" -G Ninja -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DOPENCC_ENABLE_INSTALL=OFF -DBUILD_OPENCC_JIEBA_PLUGIN=ON -DPython3_EXECUTABLE="$(command -v python3)"
cmake --build "$native_build" -j 4
mkdir -p "$root/dist/resources/"{config,dict,jieba_dict}
cp "$wasm_build/opencc.mjs" "$wasm_build/opencc.wasm" "$root/dist/"
cp "$root/adapter/runtime.mjs" "$root/dist/"
cp "$native_build/data/"*.ocd2 "$root/dist/resources/dict/"
cp "$native_build/plugins/jieba/jieba_dict/jieba_merged.ocd2" "$root/dist/resources/jieba_dict/"
for f in hmm_model.utf8 idf.utf8 stop_words.utf8; do cp "$source_dir/plugins/jieba/deps/cppjieba/dict/$f" "$root/dist/resources/jieba_dict/"; done
# Use SDK's pinned Node; it is only a build tool, never shipped in the extension.
node "$root/prepare.mjs" "$source_dir"
