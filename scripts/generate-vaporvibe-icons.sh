#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="${ROOT_DIR}/assets"
ICON_SRC_DIR="${ASSETS_DIR}/icon-src"

SVG_BOTH="${ASSETS_DIR}/vaporvibe-icon-both.svg"
SVG_MARK="${ASSETS_DIR}/vaporvibe-icon-without-text.svg"
SVG_TEXT="${ASSETS_DIR}/vaporvibe-icon-just-text.svg"

check_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' not found." >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Error: required file '$1' not found." >&2
    exit 1
  fi
}

check_command magick
require_file "${SVG_BOTH}"
require_file "${SVG_MARK}"
require_file "${SVG_TEXT}"

rm -rf "${ICON_SRC_DIR}"
mkdir -p "${ICON_SRC_DIR}"

DENSITY=600

magick -background none -density "${DENSITY}" "${SVG_MARK}" "${ICON_SRC_DIR}/mark-raw.png"
magick -background none -density "${DENSITY}" "${SVG_TEXT}" "${ICON_SRC_DIR}/text-raw.png"
magick -background none -density "${DENSITY}" "${SVG_BOTH}" "${ICON_SRC_DIR}/both-raw.png"

magick -size 1024x1024 gradient:'#1a0042-#041537' "${ICON_SRC_DIR}/bg-base.png"
magick -size 1024x1024 radial-gradient:'rgba(255,255,255,0.18)'-'rgba(255,255,255,0)' "${ICON_SRC_DIR}/bg-light.png"
magick "${ICON_SRC_DIR}/bg-base.png" "${ICON_SRC_DIR}/bg-light.png" -compose screen -composite "${ICON_SRC_DIR}/bg-mix.png"
magick -size 1024x1024 xc:none -fill white -draw 'roundrectangle 0,0 1023,1023 210,210' "${ICON_SRC_DIR}/mask-round.png"
magick "${ICON_SRC_DIR}/bg-mix.png" "${ICON_SRC_DIR}/mask-round.png" -compose CopyAlpha -composite "${ICON_SRC_DIR}/background.png"
magick -size 1024x1024 xc:none -fill 'rgba(4,10,26,0.70)' -draw 'ellipse 512,820 240,72 0,360' -blur 0x32 "${ICON_SRC_DIR}/base-shadow.png"
magick "${ICON_SRC_DIR}/background.png" "${ICON_SRC_DIR}/base-shadow.png" -compose over -composite "${ICON_SRC_DIR}/background.png"
magick -size 1024x1024 xc:none -strokewidth 10 -stroke 'rgba(120,246,255,0.35)' -fill none -draw 'roundrectangle 24,24 1000,1000 204,204' "${ICON_SRC_DIR}/border.png"

magick "${ICON_SRC_DIR}/mark-raw.png" -resize 720x720 -background none -gravity center -extent 720x720 "${ICON_SRC_DIR}/mark.png"
magick "${ICON_SRC_DIR}/both-raw.png" -resize 760x760 -background none -gravity center -extent 760x760 "${ICON_SRC_DIR}/both.png"
magick "${ICON_SRC_DIR}/text-raw.png" -resize 760x760 -background none -gravity center -extent 760x760 "${ICON_SRC_DIR}/text.png"

magick "${ICON_SRC_DIR}/background.png" \
  \( "${ICON_SRC_DIR}/mark.png" -gravity center -geometry +0-20 \) \
  -compose over -composite "${ICON_SRC_DIR}/mark-on-bg.png"
magick "${ICON_SRC_DIR}/mark-on-bg.png" "${ICON_SRC_DIR}/border.png" -compose over -composite "${ASSETS_DIR}/vaporvibe-icon-mark.png"

magick "${ICON_SRC_DIR}/background.png" \
  "${ICON_SRC_DIR}/mark.png" -gravity center -geometry +0-110 -compose over -composite \
  "${ICON_SRC_DIR}/text.png" -gravity center -geometry +0+300 -compose over -composite \
  "${ICON_SRC_DIR}/with-text-on-bg.png"
magick "${ICON_SRC_DIR}/with-text-on-bg.png" "${ICON_SRC_DIR}/border.png" -compose over -composite "${ASSETS_DIR}/vaporvibe-icon-with-text.png"

magick "${ICON_SRC_DIR}/background.png" \
  \( "${ICON_SRC_DIR}/both.png" -gravity center -geometry +0+20 \) \
  -compose over -composite "${ICON_SRC_DIR}/both-on-bg.png"
magick "${ICON_SRC_DIR}/both-on-bg.png" "${ICON_SRC_DIR}/border.png" -compose over -composite "${ASSETS_DIR}/vaporvibe-icon.png"

magick "${ICON_SRC_DIR}/text.png" -background none -gravity center -extent 1024x1024 "${ASSETS_DIR}/vaporvibe-wordmark.png"

cat <<'DONE'
Generated assets:
  - assets/vaporvibe-icon.png
  - assets/vaporvibe-icon-with-text.png
  - assets/vaporvibe-icon-mark.png
  - assets/vaporvibe-wordmark.png
Intermediates stored in assets/icon-src/
DONE
