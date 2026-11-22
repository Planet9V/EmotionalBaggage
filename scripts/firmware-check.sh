#!/usr/bin/env bash
# Builds and runs the host tests of the Baggage Claims MK1 detection core, and, when arduino-cli and the
# esp32 core are installed, compiles the sketch for the board. Usage: scripts/firmware-check.sh [host|board]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/seed/concepts/baggage-claims/files"
OUT="${TMPDIR:-/tmp}/bc-firmware"
mkdir -p "$OUT"
what="${1:-host}"
if [ "$what" = host ]; then
  g++ -std=c++17 -Wall -Wextra -Werror -O2 -I"$SRC" -o "$OUT/bc_host" "$ROOT/tests/firmware/bc_detect_host_test.cpp" "$SRC/bc_detect.cpp"
  "$OUT/bc_host"
else
  CLI="${ARDUINO_CLI:-arduino-cli}"
  SK="$OUT/BaggageClaims_MK1_RevB"
  rm -rf "$SK"; mkdir -p "$SK"
  cp "$SRC/BaggageClaims_MK1_RevB.ino" "$SRC/bc_detect.h" "$SRC/bc_detect.cpp" "$SK/"
  cp "$SRC/BaggageClaims_MK1_RevB.partitions.csv" "$SK/partitions.csv"
  "$CLI" ${ARDUINO_CLI_CONFIG:+--config-file "$ARDUINO_CLI_CONFIG"} compile --warnings all \
    --fqbn "esp32:esp32:XIAO_ESP32S3:PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=default" \
    --build-path "$OUT/build" "$SK"
fi
