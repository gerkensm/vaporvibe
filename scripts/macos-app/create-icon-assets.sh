#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/icon-build"
BASE_PNG="${OUTPUT_DIR}/ServeLLMIcon.png"
ICONSET_DIR="${OUTPUT_DIR}/ServeLLMIcon.iconset"
ICNS_PATH="${SCRIPT_DIR}/ServeLLMIcon.icns"
MODULE_CACHE="${OUTPUT_DIR}/swift-module-cache"

rm -rf "${OUTPUT_DIR}" "${ICNS_PATH}"
mkdir -p "${ICONSET_DIR}"
mkdir -p "${MODULE_CACHE}"

SWIFT_BIN="$(command -v swiftc || true)"
if [[ -z "${SWIFT_BIN}" ]]; then
  echo "swiftc not found; install Xcode command line tools." >&2
  exit 1
fi

pushd "${SCRIPT_DIR}" >/dev/null

echo "→ Generating base PNG icon…"
SWIFT_FLAGS=(
  "generate-icon.swift"
  "-module-cache-path" "${MODULE_CACHE}"
  "-o" "${OUTPUT_DIR}/generate-icon"
)

env \
  SWIFT_DRIVER_SWIFT_MODULE_CACHE_PATH="${MODULE_CACHE}" \
  SWIFT_DRIVER_CLANG_MODULE_CACHE_PATH="${MODULE_CACHE}" \
  "${SWIFT_BIN}" "${SWIFT_FLAGS[@]}"
"${OUTPUT_DIR}/generate-icon"

if [[ -f "${SCRIPT_DIR}/ServeLLMIcon.png" ]]; then
  mv "${SCRIPT_DIR}/ServeLLMIcon.png" "${BASE_PNG}"
fi

if [[ ! -f "${BASE_PNG}" ]]; then
  echo "Base icon ${BASE_PNG} not produced." >&2
  exit 1
fi

declare -a icon_entries=(
  "16:1"
  "16:2"
  "32:1"
  "32:2"
  "128:1"
  "128:2"
  "256:1"
  "256:2"
  "512:1"
  "512:2"
)

echo "→ Building .iconset variants…"
for entry in "${icon_entries[@]}"; do
  size="${entry%%:*}"
  scale="${entry##*:}"
  target_size=$(( size * scale ))
  suffix=""
  if (( scale == 2 )); then
    suffix="@2x"
  fi
  output="${ICONSET_DIR}/icon_${size}x${size}${suffix}.png"
  sips -z "$target_size" "$target_size" "${BASE_PNG}" --out "$output" >/dev/null
done

ICONUTIL_BIN="$(command -v iconutil || true)"
if [[ -z "${ICONUTIL_BIN}" ]]; then
  echo "⚠️  iconutil not found; skipped .icns generation. Use the iconset at ${ICONSET_DIR}." >&2
else
  echo "→ Converting iconset to .icns…"
  if "${ICONUTIL_BIN}" -c icns "${ICONSET_DIR}" -o "${ICNS_PATH}"; then
    echo "→ Icon ready at ${ICNS_PATH}"
  else
    echo "⚠️  iconutil failed to produce .icns. The PNG set remains at ${ICONSET_DIR}." >&2
  fi
fi

popd >/dev/null
