#!/usr/bin/env bash
# Explicit, human-initiated toolchain setup; no shell profile or system packages modified.
set -euo pipefail
base=$(realpath -m "${1:?pass a dedicated WSL ext4 cache directory}")
mkdir -p "$base/tools"
export UV_CACHE_DIR="$base/cache/uv" UV_PYTHON_INSTALL_DIR="$base/tools/python"
uv="$base/tools/uv-x86_64-unknown-linux-gnu/uv"
if [[ ! -f "$uv" ]]; then
  curl --proto "=https" --proto-redir "=https" --fail --location --retry 2 https://github.com/astral-sh/uv/releases/download/0.12.12/uv-x86_64-unknown-linux-gnu.tar.gz -o "$base/tools/uv.tar.gz"
  echo "ab9b309d4586403f024e100abaceb396616e178a553e2500c36087d180f09509  $base/tools/uv.tar.gz" | sha256sum -c -
  tar -xzf "$base/tools/uv.tar.gz" -C "$base/tools"
fi
"$uv" python install --no-bin 3.13.9
export PATH="$base/tools/python/cpython-3.13.9-linux-x86_64-gnu/bin:$base/tools/pytools/bin:$PATH"
export PYTHONPATH="$base/tools/pytools"
"$uv" pip install --python "$(command -v python3)" --target "$base/tools/pytools" cmake==3.31.10 ninja==1.13.0
if [[ ! -d "$base/tools/emsdk/.git" ]]; then git clone --branch 4.0.22 --depth 1 https://github.com/emscripten-core/emsdk.git "$base/tools/emsdk"; fi
[[ "$(git -C "$base/tools/emsdk" rev-parse HEAD)" == 15915cad554b707837024dc2758b6a1c5b94b036 ]]
[[ -z "$(git -C "$base/tools/emsdk" status --porcelain)" ]]
python3 "$base/tools/emsdk/emsdk.py" install 4.0.22
python3 "$base/tools/emsdk/emsdk.py" activate 4.0.22
printf 'Toolchain ready in %s; no shell profile was changed.\n' "$base"
