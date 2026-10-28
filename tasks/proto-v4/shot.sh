#!/usr/bin/env bash
# Screenshot one part of the assembled prototype.
# Usage: tasks/proto-v4/shot.sh <a|b|c|all> <width> <height> <out.png>
# Rebuilds first, then renders only that partial's root elements (data-part="a|b|c").
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
part="$1"; w="$2"; h="$3"; out="$4"
node "$dir/build.mjs" >/dev/null
tmp="$dir/shots/.preview-$part.html"
if [ "$part" = all ]; then hide=""; else hide="[data-part]:not([data-part=\"$part\"]){display:none!important}"; fi
sed "s#<head>#<head><base href=\"file://$dir/../\"><style>$hide .reveal{opacity:1!important;transform:none!important}</style>#" "$dir/../prototype-homepage-v4.html" > "$tmp"
chrome="$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell | tail -1)"
"$chrome" --no-sandbox --hide-scrollbars --window-size="$w,$h" --virtual-time-budget=3000 --screenshot="$out" "file://$tmp" 2>/dev/null
echo "$out"
