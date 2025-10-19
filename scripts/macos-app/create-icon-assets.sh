#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/icon-build"
BASE_PNG="${OUTPUT_DIR}/VaporVibeIcon.png"
ICONSET_DIR="${OUTPUT_DIR}/VaporVibeIcon.iconset"
ICNS_PATH="${SCRIPT_DIR}/VaporVibeIcon.icns"
GENERATOR_SCRIPT="${ROOT_DIR}/scripts/generate-vaporvibe-icons.sh"
SOURCE_ICON="${ROOT_DIR}/assets/vaporvibe-icon-mark.png"
MAGICK_BIN="$(command -v magick || true)"
SIPS_BIN="$(command -v sips || true)"
ICONUTIL_BIN="$(command -v iconutil || true)"

if [[ -z "${MAGICK_BIN}" ]]; then
  echo "ImageMagick 'magick' binary not found. Install ImageMagick to continue." >&2
  exit 1
fi

if [[ -z "${SIPS_BIN}" ]]; then
  echo "sips utility not found. This script requires macOS system tools." >&2
  exit 1
fi

if [[ -z "${ICONUTIL_BIN}" ]]; then
  echo "iconutil not found. Install Xcode command line tools (xcode-select --install)." >&2
  exit 1
fi

rm -rf "${OUTPUT_DIR}" "${ICNS_PATH}"
mkdir -p "${ICONSET_DIR}"

if [[ ! -f "${SOURCE_ICON}" ]]; then
  if [[ ! -x "${GENERATOR_SCRIPT}" ]]; then
    echo "Icon generator script not found or not executable at ${GENERATOR_SCRIPT}." >&2
    exit 1
  fi
  echo "→ Generating VaporVibe icons…"
  "${GENERATOR_SCRIPT}"
fi

if [[ ! -f "${SOURCE_ICON}" ]]; then
  echo "Source icon ${SOURCE_ICON} not found." >&2
  exit 1
fi

"${MAGICK_BIN}" "${SOURCE_ICON}" -strip -depth 8 "${BASE_PNG}"

pushd "${SCRIPT_DIR}" >/dev/null

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
  "${SIPS_BIN}" -z "$target_size" "$target_size" "${BASE_PNG}" --out "$output" >/dev/null
done


echo "→ Converting iconset to .icns via iconutil…"
if "${ICONUTIL_BIN}" -c icns "${ICONSET_DIR}" -o "${ICNS_PATH}"; then
  echo "→ Icon ready at ${ICNS_PATH}"
else
  echo "Error: iconutil failed to build .icns from ${ICONSET_DIR}" >&2
  exit 1
fi

popd >/dev/null
