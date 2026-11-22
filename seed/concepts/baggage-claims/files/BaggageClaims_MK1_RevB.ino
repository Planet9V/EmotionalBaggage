/* BAGGAGE CLAIMS MK1 - firmware Rev B (22 Nov 2026), for the 2 x AA design
 * (docs/design/baggage-claims-device.md in the app's repository).
 *
 * Board   : Seeed Studio XIAO ESP32S3 (8 MB flash), fed 3.3 V at its 3V3 pin from the boost regulator.
 *           arduino-cli FQBN  esp32:esp32:XIAO_ESP32S3:PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=default
 * Core    : Arduino-ESP32 ("esp32" by Espressif) 4.0.0. Radios are never started: no WiFi or Bluetooth code is linked in.
 * Libraries, all part of that core (nothing to install from the Library Manager):
 *           Wire 4.0.0, LittleFS 4.0.0, Preferences 4.0.0, ESP_I2S 4.0.0
 * Files   : put these four in one folder named BaggageClaims_MK1_RevB:
 *           BaggageClaims_MK1_RevB.ino, bc_detect.h, bc_detect.cpp,
 *           and BaggageClaims_MK1_RevB.partitions.csv renamed to partitions.csv (6 MB for clips).
 * Clips   : LittleFS, 16-bit mono PCM WAV (16 kHz recommended), named /p<pack>/<class>_<n>.wav, for example
 *           /p1/impact_1.wav /p1/impact_2.wav /p1/weigh_1.wav /p1/grab_1.wav /p1/freefall_1.wav /p1/throw_1.wav
 *           /p1/landing_1.wav /p1/carousel_1.wav /p1/conveyor_1.wav /p1/inverted_1.wav /p1/idle_1.wav /p1/lowbatt_1.wav
 *           Packs are /p1 to /p9; a long press cycles through those present and plays the pack's /p<k>/name_1.wav.
 *           A class with several variants (_1 to _9) never plays the same one twice running.
 *           Counted moments: /p1/impact_c1.wav ("That's one"), impact_c2.wav ("That's two"), impact_c3.wav
 *           ("too many", the third and after); carousel_c1 to _c3 for the ride and its further laps. Used in place
 *           of the plain variants when present. A landing counts as an impact.
 *           /p1/box_1.wav plays once, at the very first start (until a factory reset). idle_* (the dark hold)
 *           plays 10 dB quieter than the rest. A moment missing from a pack falls back to /p1, then to the
 *           related moment (throw -> freefall, landing -> impact), then to silence: an older pack keeps working.
 *
 * Wiring (XIAO pin = GPIO):
 *   D0 = 1  battery sense: the midpoint of 1 M / 1 M from the battery side of the regulator, 100 nF to ground
 *   D1 = 2  MPU-6050 INT (active low, latched; wakes the board)
 *   D2 = 3  amplifier SD (high = on); 10 k from SD to ground keeps the amplifier off while the board sleeps
 *   D3 = 4  button to ground, 10 k pull-up to 3V3 (wakes the board)
 *   D4 = 5  I2C SDA   D5 = 6  I2C SCL   (Adafruit MPU-6050 breakout, address 0x68, its own 10 k pull-ups)
 *   D8 = 7  I2S BCLK  D9 = 8  I2S LRC   D10 = 9  I2S DIN of the MAX98357A breakout
 *
 * NOT VERIFIED ON HARDWARE. The detection logic is tested on a PC against synthetic traces only. The sensor
 * register sequence, the sleep currents and every threshold must be checked on the bench; hold the button
 * while switching on (or send 'l' over USB) for the logging mode that records what the sensor sees.
 */
#include <Arduino.h>
#include <Wire.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <ESP_I2S.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include <sys/time.h>

#include "bc_detect.h"

// ------------------------------------------------------------------------------------------------ pins
static const int PIN_BATT = D0;
static const int PIN_INT = D1;
static const int PIN_AMP_SD = D2;
static const int PIN_BTN = D3;
static const int PIN_SDA = D4;
static const int PIN_SCL = D5;
static const int PIN_I2S_BCLK = D8;
static const int PIN_I2S_WS = D9;
static const int PIN_I2S_DOUT = D10;

// ------------------------------------------------------------------------------------------------ timing
static const uint32_t AWAKE_HOLD_MS = 45000;                    // deep sleep after this long without motion
static const uint32_t DARK_IDLE_MS = 2UL * 60UL * 60UL * 1000UL;  // the dark-idle clip: two hours without motion
static const uint32_t BATCH_MS = 200;                           // sensor batch while nothing is happening
static const uint32_t FAST_MS = 20;                             // while a flight may be in progress
static const uint32_t BATT_EVERY_MS = 30000;
static const uint16_t BATT_LOADED_STOP_MV = 1800;               // under a clip's load: stop the clip (0.9 V a cell)

// ------------------------------------------------------------------------------------------------ MPU-6050
static const uint8_t MPU = 0x68;
static const float ACC_LSB_PER_G = 2048.0f;    // +/-16 g
static const float GYR_LSB_PER_DPS = 16.4f;    // +/-2000 deg/s
// Wake-on-motion threshold. The register map (rev 4.2) gives 2 mg per LSB for the MPU-6050; some earlier
// InvenSense documents give 32 mg. 40 LSB is 80 mg at 2 mg per LSB. Check on the bench with the logging mode.
static const uint8_t WOM_THRESHOLD_LSB = 40;

static void mpuWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

static bool mpuRead(uint8_t reg, uint8_t* buf, size_t n) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)MPU, (int)n) != (int)n) return false;
  for (size_t i = 0; i < n; i++) buf[i] = (uint8_t)Wire.read();
  return true;
}

static bool mpuPresent() {
  uint8_t id = 0;
  return mpuRead(0x75, &id, 1) && (id == 0x68 || id == 0x72 || id == 0x70);  // WHO_AM_I
}

// Full measurement: 100 Hz, 94 Hz filter, +/-16 g, +/-2000 deg/s, accel and gyro into the FIFO.
static void mpuStartActive() {
  mpuWrite(0x6B, 0x01);   // PWR_MGMT_1: awake, clock from the X gyro
  delay(30);
  mpuWrite(0x6C, 0x00);   // PWR_MGMT_2: all six axes on
  mpuWrite(0x1A, 0x02);   // CONFIG: DLPF 2 (accel 94 Hz, gyro 98 Hz)
  mpuWrite(0x19, 9);      // SMPLRT_DIV: 1 kHz / (1 + 9) = 100 Hz
  mpuWrite(0x1B, 0x18);   // GYRO_CONFIG: +/-2000 deg/s
  mpuWrite(0x1C, 0x18);   // ACCEL_CONFIG: +/-16 g
  mpuWrite(0x38, 0x00);   // INT_ENABLE: none while awake
  mpuWrite(0x37, 0xA0);   // INT_PIN_CFG: active low, push-pull, latched until INT_STATUS is read
  mpuWrite(0x23, 0x78);   // FIFO_EN: gyro X Y Z and accel
  mpuWrite(0x6A, 0x04);   // USER_CTRL: reset the FIFO
  mpuWrite(0x6A, 0x40);   // USER_CTRL: FIFO on
  uint8_t st;
  mpuRead(0x3A, &st, 1);  // clear any latched interrupt
}

// Low-power accelerometer-only cycle with the motion interrupt (the wake source while the board sleeps).
// Sequence from the InvenSense MPU-6050 product specification, "Motion Interrupt"; as recalled, unverified here.
static void mpuArmWakeOnMotion() {
  mpuWrite(0x6A, 0x00);   // FIFO off
  mpuWrite(0x23, 0x00);
  mpuWrite(0x6B, 0x08);   // awake, internal oscillator, temperature sensor off
  mpuWrite(0x6C, 0x07);   // gyros in standby, accel on
  mpuWrite(0x1A, 0x00);   // accel filter wide open for the comparison
  mpuWrite(0x1C, 0x18);   // +/-16 g, high-pass filter reset
  mpuWrite(0x1F, WOM_THRESHOLD_LSB);  // MOT_THR
  mpuWrite(0x20, 1);      // MOT_DUR: 1 ms
  mpuWrite(0x69, 0x15);   // MOT_DETECT_CTRL: 1 ms accel power-on delay, decrement counters by 1
  mpuWrite(0x37, 0xA0);   // INT active low, latched
  mpuWrite(0x38, 0x40);   // INT_ENABLE: motion
  delay(5);
  mpuWrite(0x1C, 0x1F);   // high-pass filter on hold: compare against the attitude it has now
  mpuWrite(0x6C, 0x47);   // wake at 5 Hz, gyros in standby
  mpuWrite(0x6B, 0x28);   // CYCLE, temperature sensor off
  uint8_t st;
  mpuRead(0x3A, &st, 1);  // release INT
}

// Reads whole samples from the FIFO. Returns the number read; sets `overflow` when the FIFO had to be reset.
static int mpuReadFifo(bc::Sample* out, int max, bool* overflow) {
  uint8_t b[120];
  *overflow = false;
  if (!mpuRead(0x72, b, 2)) return 0;
  int bytes = ((int)b[0] << 8) | b[1];
  if (bytes >= 1008) {  // 1024-byte FIFO nearly full: samples were lost, start again
    mpuWrite(0x6A, 0x04);
    mpuWrite(0x6A, 0x40);
    *overflow = true;
    return 0;
  }
  int n = bytes / 12, got = 0;
  if (n > max) n = max;
  while (got < n) {
    int chunk = n - got;
    if (chunk > 10) chunk = 10;  // 120 bytes: inside the Wire receive buffer
    if (!mpuRead(0x74, b, (size_t)chunk * 12)) break;
    for (int i = 0; i < chunk; i++) {
      const uint8_t* p = b + i * 12;
      auto s16 = [&](int k) { return (int16_t)((p[k] << 8) | p[k + 1]); };
      bc::Sample& s = out[got++];
      s.ax = s16(0) / ACC_LSB_PER_G; s.ay = s16(2) / ACC_LSB_PER_G; s.az = s16(4) / ACC_LSB_PER_G;
      s.gx = s16(6) / GYR_LSB_PER_DPS; s.gy = s16(8) / GYR_LSB_PER_DPS; s.gz = s16(10) / GYR_LSB_PER_DPS;
    }
  }
  return got;
}

// ------------------------------------------------------------------------------------------------ state
// Kept across deep sleep (lost when the switch is turned off, which is a new journey anyway).
RTC_DATA_ATTR static bc::GovernorState rtcGov;
RTC_DATA_ATTR static bc::PickerState rtcPick;
RTC_DATA_ATTR static float rtcBias[3];
RTC_DATA_ATTR static bool rtcBiasKnown = false;
RTC_DATA_ATTR static bool rtcLowBattSaid = false;
RTC_DATA_ATTR static bool rtcIdleSaid = false;
RTC_DATA_ATTR static uint8_t rtcBattLevel = bc::BATT_OK;
RTC_DATA_ATTR static uint64_t rtcStillSinceMs = 0;   // when the motion stopped, for the dark-idle clip
// Survives a brown-out reset (which clears the variables above).
RTC_NOINIT_ATTR static uint32_t noinitMagic;
RTC_NOINIT_ATTR static uint8_t noinitBrownouts;

static bc::Detector det;
static bc::Governor gov(&rtcGov);
static Preferences prefs;
static I2SClass i2s;

static uint8_t volumeStep = 2;   // 0, 1, 2 = 50 / 75 / 100 %
static uint8_t voicePack = 1;    // /p1 to /p9
static uint8_t clipCount[bc::CLIP_CLASS_COUNT];     // variants of each class in the current pack
static uint8_t clipCountP1[bc::CLIP_CLASS_COUNT];   // and in pack 1, the fallback
static bool fsReady = false, mpuReady = false, logging = false, playing = false;
static bc::BatteryLevel battLevel = bc::BATT_OK;
static uint16_t battMv = 0;
static uint32_t lastBattMs = 0;
static uint32_t btnDownAt = 0;
static bool btnHandledLong = false;
static volatile bool stopClip = false;

// Milliseconds since the cells went in; keeps counting through deep sleep (the RTC timer).
static uint64_t upMs() {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return (uint64_t)tv.tv_sec * 1000ULL + (uint64_t)(tv.tv_usec / 1000);
}

// ------------------------------------------------------------------------------------------------ battery
// Two AA cells through 1 M / 1 M: the pin sees half the battery voltage.
static uint16_t readBatteryMv() {
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogReadMilliVolts(PIN_BATT);
  return (uint16_t)(sum / 8 * 2);
}

static void updateBattery() {
  battMv = readBatteryMv();
  bc::BatteryLevel level = bc::batteryLevel(battMv, (bc::BatteryLevel)rtcBattLevel);
  // a brown-out reset says more than a resting voltage: one means very low, two mean empty
  if (noinitBrownouts >= 2 && level < bc::BATT_EMPTY) level = bc::BATT_EMPTY;
  else if (noinitBrownouts == 1 && level < bc::BATT_VERY_LOW) level = bc::BATT_VERY_LOW;
  if (level == bc::BATT_OK) rtcLowBattSaid = false;  // new cells: the warning may be given again
  battLevel = level;
  rtcBattLevel = level;
  lastBattMs = millis();
}

// ------------------------------------------------------------------------------------------------ clips
// /p<pack>/<stem>_<suffix>.wav: the suffix is the variant 1 to 9, or c1 to c3 for a count step.
static String clipPath(uint8_t pack, bc::ClipClass c, const String& suffix) {
  return String("/p") + pack + "/" + bc::clipClassName(c) + "_" + suffix + ".wav";
}

static void scanPack(uint8_t pack, uint8_t* counts) {
  for (int c = 0; c < bc::CLIP_CLASS_COUNT; c++) {
    uint8_t n = 0;
    while (n < bc::MAX_VARIANTS && fsReady && LittleFS.exists(clipPath(pack, (bc::ClipClass)c, String(n + 1)))) n++;
    counts[c] = n;
  }
}

static void scanClips() {
  scanPack(voicePack, clipCount);
  scanPack(1, clipCountP1);
}

// The file for a class: the count step's own clip if the pack (or pack 1) has one, else a variant from the
// pack, else from pack 1, else the same from the related class. Empty when there is none.
static String resolveClip(bc::ClipClass wanted, uint8_t step) {
  const bc::ClipClass tries[2] = {wanted, bc::clipFallback(wanted)};
  for (bc::ClipClass c : tries) {
    if (step > 0) {
      const String suffix = String("c") + step;
      if (fsReady && LittleFS.exists(clipPath(voicePack, c, suffix))) return clipPath(voicePack, c, suffix);
      if (fsReady && LittleFS.exists(clipPath(1, c, suffix))) return clipPath(1, c, suffix);
    }
    if (clipCount[c] > 0) return clipPath(voicePack, c, String(bc::pickVariant(&rtcPick, c, clipCount[c])));
    if (clipCountP1[c] > 0) return clipPath(1, c, String(bc::pickVariant(&rtcPick, c, clipCountP1[c])));
  }
  return String();
}

static bool packExists(uint8_t pack) {
  return fsReady && LittleFS.exists(String("/p") + pack);
}

static void sensorPump();
static void serviceButton();

// Finds the PCM data of a 16-bit mono WAV. Returns the sample rate, or 0 when the file is not one.
static uint32_t wavOpen(File& f, uint32_t* dataBytes) {
  uint8_t h[12];
  if (f.read(h, 12) != 12 || memcmp(h, "RIFF", 4) != 0 || memcmp(h + 8, "WAVE", 4) != 0) return 0;
  uint32_t rate = 0;
  bool fmtOk = false;
  while (f.available() >= 8) {
    uint8_t ch[8];
    if (f.read(ch, 8) != 8) return 0;
    uint32_t size = (uint32_t)ch[4] | ((uint32_t)ch[5] << 8) | ((uint32_t)ch[6] << 16) | ((uint32_t)ch[7] << 24);
    if (memcmp(ch, "fmt ", 4) == 0) {
      uint8_t fmt[16];
      if (size < 16 || f.read(fmt, 16) != 16) return 0;
      const uint16_t format = fmt[0] | (fmt[1] << 8), channels = fmt[2] | (fmt[3] << 8), bits = fmt[14] | (fmt[15] << 8);
      rate = (uint32_t)fmt[4] | ((uint32_t)fmt[5] << 8) | ((uint32_t)fmt[6] << 16) | ((uint32_t)fmt[7] << 24);
      fmtOk = format == 1 && channels == 1 && bits == 16 && rate >= 8000 && rate <= 48000;
      if (size > 16) f.seek(f.position() + (size - 16) + (size & 1));
    } else if (memcmp(ch, "data", 4) == 0) {
      *dataBytes = size;
      return fmtOk ? rate : 0;
    } else {
      f.seek(f.position() + size + (size & 1));
    }
  }
  return 0;
}

// Plays one clip to the end (or until the button stops it, or the battery sags). The sensor keeps being read.
static bool playClip(bc::ClipClass wanted, uint8_t step = 0) {
  const String path = resolveClip(wanted, step);
  if (!path.length()) {
    Serial.printf("CLIP: none for %s in /p%u or /p1\n", bc::clipClassName(wanted), voicePack);
    return false;
  }
  File f = LittleFS.open(path, "r");
  uint32_t bytes = 0;
  const uint32_t rate = f ? wavOpen(f, &bytes) : 0;
  if (!rate) {
    Serial.printf("CLIP: %s is not a 16-bit mono PCM WAV\n", path.c_str());
    if (f) f.close();
    return false;
  }
  const int32_t gain = bc::clipGainQ15(wanted, volumeStep, battLevel);
  Serial.printf("PLAY %s  %lu Hz  %lu bytes  gain %ld/32768  batt %u mV\n", path.c_str(), (unsigned long)rate, (unsigned long)bytes, (long)gain, battMv);
  i2s.setPins(PIN_I2S_BCLK, PIN_I2S_WS, PIN_I2S_DOUT);
  if (!i2s.begin(I2S_MODE_STD, rate, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO)) {
    Serial.println("CLIP: the I2S output did not start");
    f.close();
    return false;
  }
  digitalWrite(PIN_AMP_SD, HIGH);
  playing = true;
  stopClip = false;
  det.setPlaying(true);
  static int16_t mono[256];
  static int16_t stereo[512];
  uint32_t left = bytes;
  uint16_t minMv = battMv;
  int blocks = 0;
  while (left >= 2 && !stopClip) {
    const size_t want = left < sizeof(mono) ? (left & ~1u) : sizeof(mono);
    const int got = f.read((uint8_t*)mono, want);
    if (got <= 0) break;
    const int n = got / 2;
    for (int i = 0; i < n; i++) {
      const int16_t s = (int16_t)(((int32_t)mono[i] * gain) >> 15);
      stereo[2 * i] = s;
      stereo[2 * i + 1] = s;
    }
    i2s.write((const uint8_t*)stereo, (size_t)n * 4);
    left -= (uint32_t)got;
    sensorPump();     // flights and impacts are still seen; the slow detectors hold
    serviceButton();  // a tap stops the clip
    if (++blocks % 8 == 0) {
      const uint16_t mv = readBatteryMv();
      if (mv < minMv) minMv = mv;
      if (mv < BATT_LOADED_STOP_MV) {
        Serial.printf("BATT: %u mV under load, clip stopped\n", mv);
        if (rtcBattLevel < bc::BATT_VERY_LOW) rtcBattLevel = bc::BATT_VERY_LOW;
        battLevel = (bc::BatteryLevel)rtcBattLevel;
        break;
      }
    }
  }
  memset(stereo, 0, sizeof(stereo));
  i2s.write((const uint8_t*)stereo, sizeof(stereo));  // let the last samples out
  delay(30);
  digitalWrite(PIN_AMP_SD, LOW);
  i2s.end();
  f.close();
  playing = false;
  det.setPlaying(false);
  gov.notePlaybackEnd(upMs());
  noinitBrownouts = 0;  // a clip played through: the cells still carry the load
  Serial.printf("PLAY done  lowest battery under load %u mV\n", minMv);
  return true;
}

// ------------------------------------------------------------------------------------------------ events
static void onEvent(bc::Event e) {
  const uint64_t now = upMs();
  if (logging) Serial.printf("# EVT %s t=%lu\n", bc::eventName(e), (unsigned long)det.nowMs());
  if (battLevel == bc::BATT_EMPTY) {
    Serial.printf("EVT %s  (battery empty: no clip)\n", bc::eventName(e));
    return;
  }
  const bc::Governor::Verdict v = gov.request(e, now, playing);
  const uint8_t step = gov.countStep(e);
  Serial.printf("EVT %s  count step %u  -> %s\n", bc::eventName(e), step, bc::Governor::verdictName(v));
  if (v != bc::Governor::PLAY) return;
  playClip(bc::clipClassFor(e), step);
}

static void sensorPump() {
  if (!mpuReady) return;
  static bc::Sample buf[84];
  bool overflow = false;
  const int n = mpuReadFifo(buf, 84, &overflow);
  if (overflow) Serial.println("FIFO overflow: samples lost");
  for (int i = 0; i < n; i++) {
    const bc::Event e = det.update(buf[i]);
    if (logging) {
      Serial.printf("%lu,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.1f,%.0f,%d\n", (unsigned long)det.nowMs(), buf[i].ax, buf[i].ay, buf[i].az, buf[i].gx, buf[i].gy, buf[i].gz,
                    det.tiltFromRestDeg(), det.yawTurnDeg(), det.still() ? 1 : 0);
    }
    if (e != bc::EV_NONE) {
      gov.noteEvent(e);  // the running score counts every impact and lap, played or not
      if (playing) {
        Serial.printf("EVT %s  -> %s\n", bc::eventName(e), bc::Governor::verdictName(bc::Governor::REFUSED_BUSY));
      } else {
        onEvent(e);
      }
    }
  }
  if (det.msSinceMotion() < 1000) {
    gov.noteMotion(upMs());
    rtcStillSinceMs = upMs();
    rtcIdleSaid = false;
  }
}

// ------------------------------------------------------------------------------------------------ button
// Tap: volume 50 / 75 / 100 % (or stop the clip that is playing). Hold 1.5 s: next voice pack. Hold 10 s: reset.
static void serviceButton() {
  const bool down = digitalRead(PIN_BTN) == LOW;
  const uint32_t now = millis();
  if (down && !btnDownAt) {
    btnDownAt = now ? now : 1;
    btnHandledLong = false;
  }
  if (down && btnDownAt && !btnHandledLong && now - btnDownAt > 10000) {
    btnHandledLong = true;
    Serial.println("BTN: reset to factory settings");
    prefs.clear();
    delay(100);
    ESP.restart();
  }
  if (!down && btnDownAt) {
    const uint32_t held = now - btnDownAt;
    btnDownAt = 0;
    if (held < 30) return;  // bounce
    if (playing) {
      stopClip = true;
      Serial.println("BTN: clip stopped");
    } else if (held >= 1500) {
      uint8_t next = voicePack;
      for (int i = 0; i < bc::MAX_PACKS; i++) {
        next = (uint8_t)(next % bc::MAX_PACKS + 1);
        if (packExists(next)) break;
      }
      voicePack = next;
      prefs.putUChar("pack", voicePack);
      scanClips();
      Serial.printf("BTN: voice pack %u\n", voicePack);
      if (clipCount[bc::CLIP_NAME] > 0) playClip(bc::CLIP_NAME);  // the pack says its name (its own clip only)
    } else {
      volumeStep = (uint8_t)((volumeStep + 1) % 3);
      prefs.putUChar("vol", volumeStep);
      Serial.printf("BTN: volume step %u of 3\n", volumeStep + 1);
    }
  }
}

// ------------------------------------------------------------------------------------------------ serial
static void printStatus() {
  float bx, by, bz;
  det.gyroBias(bx, by, bz);
  Serial.printf("STATUS batt=%u mV level=%u vol=%u pack=%u fs=%d mpu=%d bias=(%.2f,%.2f,%.2f) brownouts=%u still=%d sinceMotion=%lu ms\n", battMv, (unsigned)battLevel, volumeStep + 1,
                voicePack, fsReady, mpuReady, bx, by, bz, noinitBrownouts, det.still(), (unsigned long)det.msSinceMotion());
  for (int c = 0; c < bc::CLIP_CLASS_COUNT; c++) Serial.printf("  %s: %u clip(s)\n", bc::clipClassName((bc::ClipClass)c), clipCount[c]);
}

// 'l' logging on/off (CSV: ms,ax,ay,az,gx,gy,gz,tilt,turn,still), 's' status,
// 'p' then a digit 0-9, 'a' (lowbatt), 'b' (box) or 'n' (name): play that class.
static void serviceSerial() {
  while (Serial.available()) {
    const int ch = Serial.read();
    if (ch == 'l') {
      logging = !logging;
      Serial.println(logging ? "# logging on: ms,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,tilt_deg,turn_deg,still" : "# logging off");
    } else if (ch == 's') {
      updateBattery();
      printStatus();
    } else if (ch == 'p') {
      delay(20);
      const int d = Serial.read();
      const int c = d == 'a' ? bc::CLIP_LOWBATT : d == 'b' ? bc::CLIP_BOX : d == 'n' ? bc::CLIP_NAME : d - '0';
      if (c >= 0 && c < bc::CLIP_CLASS_COUNT) playClip((bc::ClipClass)c);
    }
  }
}

// ------------------------------------------------------------------------------------------------ sleep
static void goToDeepSleep() {
  float bx, by, bz;
  det.gyroBias(bx, by, bz);
  rtcBias[0] = bx; rtcBias[1] = by; rtcBias[2] = bz;
  rtcBiasKnown = det.gyroBiasKnown();
  digitalWrite(PIN_AMP_SD, LOW);
  if (mpuReady) mpuArmWakeOnMotion();
  const uint64_t mask = (1ULL << PIN_INT) | (1ULL << PIN_BTN);
  esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_LOW);
  // the dark-idle clip: one timed wake two hours after the motion stopped, once per stop
  if (!rtcIdleSaid && battLevel < bc::BATT_EMPTY) {
    const uint64_t stillFor = upMs() - rtcStillSinceMs;
    const uint64_t wait = stillFor < DARK_IDLE_MS ? DARK_IDLE_MS - stillFor : 1000;
    esp_sleep_enable_timer_wakeup(wait * 1000ULL);
  }
  Serial.println("SLEEP");
  Serial.flush();
  esp_deep_sleep_start();
}

static void napBetweenBatches(uint32_t ms) {
  // With a computer on the USB port, or in logging mode, stay awake so the serial port stays up.
  if (logging || Serial) {
    delay(ms);
    return;
  }
  gpio_wakeup_enable((gpio_num_t)PIN_BTN, GPIO_INTR_LOW_LEVEL);
  esp_sleep_enable_gpio_wakeup();
  esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000ULL);
  esp_light_sleep_start();
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
}

// ------------------------------------------------------------------------------------------------ setup / loop
void setup() {
  pinMode(PIN_AMP_SD, OUTPUT);
  digitalWrite(PIN_AMP_SD, LOW);
  pinMode(PIN_BTN, INPUT);        // external 10 k pull-up
  pinMode(PIN_INT, INPUT_PULLUP);
  setCpuFrequencyMhz(80);         // enough for 100 Hz of samples and 16 kHz audio
  Serial.begin(115200);

  const esp_reset_reason_t why = esp_reset_reason();
  if (noinitMagic != 0xBC2AA001u || why == ESP_RST_POWERON) {
    noinitMagic = 0xBC2AA001u;
    noinitBrownouts = 0;
  }
  if (why == ESP_RST_BROWNOUT && noinitBrownouts < 250) noinitBrownouts++;
  const bool timerWake = why == ESP_RST_DEEPSLEEP && (esp_sleep_get_wakeup_causes() & (1UL << ESP_SLEEP_WAKEUP_TIMER)) != 0;

  prefs.begin("bc", false);
  volumeStep = prefs.getUChar("vol", 2);
  if (volumeStep > 2) volumeStep = 2;
  voicePack = prefs.getUChar("pack", 1);
  if (voicePack < 1 || voicePack > bc::MAX_PACKS) voicePack = 1;

  fsReady = LittleFS.begin(false);
  if (fsReady && !packExists(voicePack)) voicePack = 1;
  scanClips();

  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);
  Wire.setTimeOut(50);
  mpuReady = mpuPresent();
  if (mpuReady) mpuStartActive();
  if (rtcBiasKnown) det.setGyroBias(rtcBias[0], rtcBias[1], rtcBias[2]);
  if (!rtcPick.rng) rtcPick.rng = esp_random() | 1u;
  if (why != ESP_RST_DEEPSLEEP) {
    rtcStillSinceMs = upMs();
    gov.noteMotion(upMs());
  }

  analogReadResolution(12);
  updateBattery();
  // holding the button while switching on starts the logging mode
  if (why != ESP_RST_DEEPSLEEP && digitalRead(PIN_BTN) == LOW) logging = true;

  Serial.printf("BAGGAGE CLAIMS MK1 Rev B  reset=%d  batt=%u mV  %s  %s%s\n", (int)why, battMv, mpuReady ? "MPU OK" : "MPU FAIL (check wiring)", fsReady ? "FS OK" : "FS FAIL (upload the clips)",
                logging ? "  LOGGING" : "");

  // the first start out of the box, once in the unit's life (a factory reset clears the flag)
  if (fsReady && why != ESP_RST_DEEPSLEEP && !prefs.getBool("boxed", false) && battLevel < bc::BATT_VERY_LOW) {
    prefs.putBool("boxed", true);
    playClip(bc::CLIP_BOX);
  }
  // the low-battery line, once
  if (battLevel == bc::BATT_VERY_LOW && !rtcLowBattSaid) {
    rtcLowBattSaid = true;
    playClip(bc::CLIP_LOWBATT);
  }
  // woken by the two-hour timer with nothing having moved: the dark-idle line, then back to sleep
  if (timerWake) {
    rtcIdleSaid = true;
    if (battLevel < bc::BATT_EMPTY && gov.request(bc::EV_NONE, upMs(), false) == bc::Governor::PLAY) playClip(bc::CLIP_IDLE);
    goToDeepSleep();
  }
}

void loop() {
  sensorPump();
  serviceButton();
  serviceSerial();
  if (millis() - lastBattMs > BATT_EVERY_MS) {
    const bc::BatteryLevel before = battLevel;
    updateBattery();
    if (battLevel == bc::BATT_VERY_LOW && before < bc::BATT_VERY_LOW && !rtcLowBattSaid) {
      rtcLowBattSaid = true;
      playClip(bc::CLIP_LOWBATT);
    }
  }
  const bool usb = (bool)Serial;
  if (!logging && !usb && !btnDownAt && (!mpuReady || det.msSinceMotion() > AWAKE_HOLD_MS)) goToDeepSleep();
  napBetweenBatches(det.attention() ? FAST_MS : BATCH_MS);
}
