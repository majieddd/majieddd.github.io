#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-starter}"
CONFIRM="${2:-}"
DEST="${UAP_DEST:-official_uap_downloads}"
mkdir -p "$DEST"

BASE_ZIP="https://catalog.archives.gov/medialz/bulk-downloads/uaps/zips"
BASE_JSON="https://catalog.archives.gov/medialz/bulk-downloads/uaps/JSON"

fetch() {
  local url="$1"
  local out="$2"
  echo "Downloading $out"
  curl -L --fail --retry 4 --retry-delay 3 --continue-at - --output "$DEST/$out" "$url"
}

fetch_pair() {
  local folder="$1"
  local id="$2"
  fetch "$BASE_ZIP/$folder/$id.zip" "$id.zip"
  fetch "$BASE_JSON/catalog-export-$id.json" "catalog-export-$id.json"
}

starter() {
  fetch_pair electronic-records 488808322
  fetch_pair electronic-records 493468575
  fetch_pair electronic-records 493468579
  fetch_pair electronic-records 493468580
  fetch_pair textual-and-microfilm 595175
  fetch_pair textual-and-microfilm 595466
  fetch_pair moving-images 262327376
  fetch_pair moving-images 25738
  fetch_pair moving-images 127614
}

medium() {
  starter
  fetch_pair moving-images 61934
  fetch_pair moving-images 68170
  fetch_pair moving-images 68175
  fetch_pair moving-images 68405
  fetch_pair moving-images 72035
}

large() {
  if [[ "$CONFIRM" != "I_UNDERSTAND_HUNDREDS_OF_GB" ]]; then
    echo "Large mode is hundreds of gigabytes."
    echo "Re-run: $0 large I_UNDERSTAND_HUNDREDS_OF_GB"
    exit 2
  fi
  medium
  fetch_pair still-pictures 542184
  fetch "$BASE_JSON/catalog-export-597821.json" "catalog-export-597821.json"
  for kind in images pdfs; do
    for part in 1 2 3 4 5; do
      fetch "$BASE_ZIP/textual-and-microfilm/597821-${kind}-${part}.zip" "597821-${kind}-${part}.zip"
    done
  done
  for id in 733667 17618564 23857122 23857158 23857159 23857160 45484701; do
    fetch_pair textual-and-microfilm "$id"
  done
  fetch_pair moving-images 566658
}

case "$MODE" in
  starter) starter ;;
  medium) medium ;;
  large) large ;;
  *)
    echo "Usage: $0 [starter|medium|large] [confirmation-token]"
    exit 1
    ;;
esac

echo "Finished. Files are in $DEST"
