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
  # BC_CTAGS_STUB=1: where Arduino's ctags cannot be downloaded, stand in a ctags that reports no tags. arduino-cli
  # then adds no prototypes, which this sketch does not need (it declares its own); everything else is the real build.
  EXTRA=()
  if [ "${BC_CTAGS_STUB:-}" = 1 ]; then
    mkdir -p "$OUT/ctags-stub"
    printf '#!/bin/sh\nexit 0\n' > "$OUT/ctags-stub/ctags"
    chmod +x "$OUT/ctags-stub/ctags"
    EXTRA=(--build-property "runtime.tools.ctags.path=$OUT/ctags-stub")
  fi
  "$CLI" ${ARDUINO_CLI_CONFIG:+--config-file "$ARDUINO_CLI_CONFIG"} compile --warnings all "${EXTRA[@]}" \
    --fqbn "esp32:esp32:XIAO_ESP32S3:PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=default" \
    --build-path "$OUT/build" "$SK"
fi
