// BAGGAGE CLAIMS MK1 - detection core, Rev B (22 Nov 2026)
//
// Hardware-independent C++ (no Arduino headers): the event detector, the anti-annoyance governor, the clip
// picker and the battery policy. The sketch BaggageClaims_MK1_RevB.ino feeds it samples from the MPU-6050;
// the host tests (tests/firmware/bc_detect_host_test.cpp) feed it synthetic traces and are built with g++.
//
// Units: acceleration in g, rotation in degrees per second, time in milliseconds.
// Sample rate: 100 Hz (one update() call per 10 ms sample). Sensor: +/-16 g, +/-2000 dps, 94 Hz filter.
// Every threshold below is a starting value chosen by calculation (docs/design/baggage-claims-device.md,
// section 3). None has been tuned on real luggage; the sketch's logging mode exists to do that.
#ifndef BC_DETECT_H
#define BC_DETECT_H

#include <stdint.h>

namespace bc {

const int SAMPLE_HZ = 100;
const int SAMPLE_MS = 1000 / SAMPLE_HZ;

struct Sample {
  float ax, ay, az;  // g
  float gx, gy, gz;  // deg/s
};

// In priority order: when two fire on the same sample the lower number is reported first.
enum Event : uint8_t {
  EV_NONE = 0,
  EV_THROW,     // launch, then at least flightMinMs in the air
  EV_FREEFALL,  // at least flightMinMs in the air with no launch before it (a drop)
  EV_LANDING,   // the bump that ends a flight (reported so the caller can pick a landing clip)
  EV_IMPACT,    // hard impact that did not end a flight
  EV_CAROUSEL,  // at least 15 s of quiet transport with at least 120 degrees of turn in one direction
  EV_WEIGH_IN,  // moved, then dead still for 3.5 to 6 s, then moved again
  EV_GRAB,      // from rest: tilt and quick motion, then sustained tilt and steady carry motion
  EV_CONVEYOR,  // at least 8 s of steady vibration with no walking rhythm and little turning
  EV_INVERTED,  // the tag's own "up" axis pointing down for more than 4 s
  EV_COUNT
};

const char* eventName(Event e);

struct Config {
  // --- flight (throw and free-fall) ---
  float flightG = 0.35f;            // |a| below this counts as "in the air" ...
  float flightSpinK = 0.046f;       // ... plus this times (rad/s)^2: the tag is up to 0.45 m off the bag's spin axis
  float flightSpinMaxG = 0.45f;     // ... the spin allowance never exceeds this
  uint16_t flightMinMs = 300;       // owner's ruling: free-fall is a duration over 0.3 s
  uint8_t flightGapSamples = 1;     // samples above the limit tolerated inside a flight
  uint16_t launchWindowMs = 600;    // looked at when the flight begins
  float launchDeadbandG = 1.15f;    // |a| above this before the flight counts toward the launch impulse
  float launchImpulseGs = 0.08f;    // g-seconds over the window (0.08 g s is about 0.8 m/s) ...
  float launchPeakG = 2.0f;         // ... or one sample above this: either makes it a throw
  uint16_t landingWindowMs = 300;   // after the flight ends
  float landingG = 2.5f;
  // --- hard impact ---
  float impactG = 6.0f;             // peak |a| on the +/-16 g range
  uint16_t impactRefractoryMs = 1000;
  uint16_t impactAfterFlightMs = 1500;  // an impact this soon after a flight event is that flight's landing
  // --- motion and stillness ---
  float movingDynG = 0.10f;         // |a - gravity| above this, or ...
  float movingGyroDps = 15.0f;      // ... turning faster than this, is motion (keeps the device awake)
  float stillVarG2 = 0.0006f;       // summed variance of the three accel axes over 0.5 s
  float stillGyroVar = 12.0f;       // summed variance of the three gyro axes over 0.5 s, (deg/s)^2
  float stillGyroDps = 4.0f;        // and turning slower than this after bias removal
  float biasGateDps = 6.0f;         // a still gyro reading this far from the bias is rotation, not bias
  // --- weigh-in ---
  uint16_t weighMinMs = 3500;
  uint16_t weighMaxMs = 6000;
  float weighLiftG = 0.25f;         // a lift this strong ...
  uint16_t weighLiftWithinMs = 3000;  // ... at most this long before the stillness began
  // --- handle grab ---
  uint16_t grabRestMs = 1000;       // at rest this long before the grab
  uint16_t grabWindowMs = 1500;     // tilt and quick motion must both show within this of leaving rest
  float grabTiltDeg = 20.0f;
  float grabQuickG = 0.30f;
  float grabQuickDps = 60.0f;
  uint16_t carryMs = 4000;          // then this much carry
  float carryTiltDeg = 12.0f;       // tilt from the rest attitude held for carryTiltShare of it
  float carryTiltShare = 0.70f;
  float carryStdMinG = 0.04f;       // 1 s windows whose |a| standard deviation is in this band ...
  float carryStdMaxG = 0.60f;
  float carryWindowShare = 0.75f;   // ... for this share of the windows
  // --- conveyor / cart ride ---
  float rideStdMinG = 0.03f;
  float rideStdMaxG = 0.30f;
  float rideGyroMaxDps = 25.0f;     // mean turning rate in the window
  uint8_t rideMinCrossings = 8;     // zero crossings of |a| - mean in 1 s: 8 is a 4 Hz rhythm, above walking
  uint8_t rideSeconds = 8;
  float rideYawDeferDeg = 30.0f;    // a ride that is already turning waits for the carousel decision
  // --- carousel ---
  float carouselYawMinDps = 4.0f;   // turning about the vertical between these rates
  float carouselYawMaxDps = 60.0f;
  float carouselOffAxisMaxDps = 20.0f;  // and not tumbling about the other axes
  float carouselStdMaxG = 0.15f;    // quiet transport: not carried, not handled
  uint8_t carouselSeconds = 15;     // owner's ruling: about 15 s or more
  float carouselTurnDeg = 120.0f;   // net turn in one direction
  float carouselConsistency = 0.80f;  // |net| / (left + right)
  float carouselLeakPerS = 0.975f;  // turn older than about 40 s fades
  float carouselLapDeg = 360.0f;    // after the first report, each further lap of net turn in the same ride is reported again
  // --- inverted ---
  float upX = 0.0f, upY = 1.0f, upZ = 0.0f;  // the tag's "up" in sensor axes (the loop end); set for the enclosure
  float invertedCos = -0.90f;
  uint16_t invertedMs = 4000;
};

class Detector {
 public:
  explicit Detector(const Config& cfg = Config());
  void reset();

  // One sample in; at most one event out. Events found on the same sample are queued and come out on the
  // following calls in priority order.
  Event update(const Sample& s);

  // True while something is in progress that the caller should poll quickly for (a possible flight).
  bool attention() const { return lowRun_ > 0 || landingLeft_ > 0; }
  // Milliseconds since the last sample that counted as motion.
  uint32_t msSinceMotion() const { return now_ - lastMotionMs_; }
  bool still() const { return still_; }
  // The speaker shakes the sensor: while a clip plays, the slow detectors hold their state.
  void setPlaying(bool playing) { playing_ = playing; }
  // Gyro zero-rate offset, kept by the caller across sleep.
  void setGyroBias(float x, float y, float z) { bx_ = x; by_ = y; bz_ = z; biasKnown_ = true; }
  void gyroBias(float& x, float& y, float& z) const { x = bx_; y = by_; z = bz_; }
  bool gyroBiasKnown() const { return biasKnown_; }
  // For the logging mode.
  float tiltFromRestDeg() const;
  float yawTurnDeg() const { return yawPos_ - yawNeg_; }
  uint32_t nowMs() const { return now_; }
  bool lastFlightWasThrow() const { return flightThrown_; }

 private:
  void queue(Event e) { pending_ |= (uint16_t)(1u << e); }
  Event pop();
  void secondWindow();

  Config c_;
  uint32_t now_;
  uint16_t pending_;
  bool playing_;

  // gravity estimates (unit-length where possible)
  float gx_, gy_, gz_;     // slow, only updated when quasi-static
  float fx_, fy_, fz_;     // fast, always updated: the mean direction while carried
  float rx_, ry_, rz_;     // attitude latched at rest
  bool haveRest_;
  bool started_;

  // gyro bias
  float bx_, by_, bz_;
  bool biasKnown_;

  // 0.5 s window for stillness
  static const int WIN = 50;
  float wa_[WIN][3];
  float wg_[WIN][3];
  int wi_, wn_;
  double sa_[3], sa2_[3], sg_[3], sg2_[3];
  bool still_;
  uint32_t stillStart_;
  uint32_t lastMotionMs_;
  uint32_t lastStrongMs_;
  bool stillHadLift_;

  // launch history: |a| over the last 0.8 s
  static const int HIST = 80;
  float hist_[HIST];
  int hi_;

  // flight
  uint16_t lowRun_;        // samples in the air
  uint8_t lowGap_;
  bool flightReported_;
  bool flightThrown_;
  uint16_t landingLeft_;   // ms left to see the landing
  uint32_t flightEventMs_;
  bool hadFlight_;
  uint32_t lastImpactMs_;
  bool hadImpact_;

  // grab
  uint8_t grabStage_;      // 0 idle, 1 left rest and looking for tilt + quick motion, 2 carrying
  uint32_t grabT0_;
  bool grabTilt_, grabQuick_;
  uint16_t carrySamples_, carryTilted_;
  uint8_t carryWindows_, carryGood_;
  uint16_t carryStill_;

  // 1 s window statistics
  int secN_;
  double secSum_, secSum2_;
  double secYaw_, secOff_, secGyro_;
  float secPrev_;
  uint8_t secCross_;
  bool secHaveMean_;
  float secMeanPrev_;

  // ride and carousel
  int8_t rideScore_;
  bool rideReported_;
  uint8_t rideDeferred_;
  uint16_t transportS_;
  float yawPos_, yawNeg_;
  bool carouselReported_;
  float rideTurnDeg_;      // net turn about the vertical in this ride, not faded (for the laps)
  float lapBaseDeg_;       // rideTurnDeg_ when the last lap was reported

  // inverted
  uint16_t invertedMs_;
  bool invertedReported_;
};

// ---------------------------------------------------------------------------------------------------------
// Governor: one gag per event class per journey phase, a cooldown between gags, and a cap per hour.
// (Design package Rev A, section 1.5; the sketch of 19 Nov: PHASE_RESET_MS, COOLDOWN_MS, MAX_GAGS_HOUR.)
struct GovernorState {
  uint16_t usedMask;       // classes already played this journey phase
  uint8_t impacts;         // impacts (and landings) seen this journey phase, played or not: the running score
  uint8_t carousels;       // carousel reports this phase: the first ride, then each further lap
  uint8_t impactStep;      // the highest count step (1, 2, 3 = "too many") already played this phase
  uint8_t carouselStep;
  uint8_t gagsThisHour;
  uint64_t hourStartMs;
  uint64_t lastGagEndMs;
  uint64_t lastMotionMs;
  bool everPlayed;
};

class Governor {
 public:
  static const uint32_t COOLDOWN_MS = 3000;
  static const uint8_t MAX_PER_HOUR = 6;
  static const uint32_t PHASE_RESET_MS = 60UL * 60UL * 1000UL;

  enum Verdict : uint8_t { PLAY = 0, REFUSED_BUSY, REFUSED_CLASS_USED, REFUSED_COOLDOWN, REFUSED_HOUR_CAP };

  explicit Governor(GovernorState* s) : s_(s) {}
  // Call when motion is seen: a gap of PHASE_RESET_MS without motion starts a new journey phase.
  void noteMotion(uint64_t nowMs);
  // Counts an event seen (call for every event, before request, whether or not it will play).
  void noteEvent(Event e);
  // For a counted class (impact and landing; carousel): 1 for the first this phase, 2 for the second, 3 for the
  // third and after. 0 for a class that is not counted. A counted class may play once per step, so the score
  // ("That's one", "That's two", "Too many") and the laps run across one journey phase.
  uint8_t countStep(Event e) const;
  static const uint8_t COUNT_STEPS = 3;
  // Asks to play a clip of class `e`. On PLAY the class is latched and counted.
  Verdict request(Event e, uint64_t nowMs, bool busy);
  void notePlaybackEnd(uint64_t nowMs) { s_->lastGagEndMs = nowMs; }
  static const char* verdictName(Verdict v);

 private:
  GovernorState* s_;
};

// ---------------------------------------------------------------------------------------------------------
// Clip classes on the file system, and a picker that never plays the same variant of a class twice running.
enum ClipClass : uint8_t {
  CLIP_IMPACT = 0, CLIP_WEIGH, CLIP_GRAB, CLIP_FREEFALL, CLIP_THROW, CLIP_LANDING,
  CLIP_CAROUSEL, CLIP_CONVEYOR, CLIP_INVERTED, CLIP_IDLE, CLIP_LOWBATT,
  CLIP_BOX,    // the first start out of the box, once in the unit's life (until a factory reset)
  CLIP_NAME,   // the pack says its own name, after a long press selects it
  CLIP_CLASS_COUNT
};
// The clip plan, the same for every pack: a file stem per moment (clipClassName), variants _1 to _9, and for a
// counted class the steps _c1, _c2, _c3. A moment added later gets a new stem; a pack without it falls back to
// pack 1, then to clipFallback, then plays nothing, so an older pack keeps working on newer firmware.
const uint8_t MAX_VARIANTS = 9;
const uint8_t MAX_PACKS = 9;   // /p1 to /p9; a long press cycles through the ones present
const char* clipClassName(ClipClass c);          // "impact", "weigh", ... : the file name stem
ClipClass clipClassFor(Event e);
ClipClass clipFallback(ClipClass c);              // throw -> freefall, landing -> impact, else itself

struct PickerState {
  uint8_t last[CLIP_CLASS_COUNT];  // last variant played per class, 0 = none yet
  uint32_t rng;
};

// Variants are numbered 1..count. Returns 0 when count is 0. With two or more variants the result is never
// the one returned last time for that class.
uint8_t pickVariant(PickerState* st, ClipClass c, uint8_t count);

// ---------------------------------------------------------------------------------------------------------
// Battery policy for two alkaline AA cells in series, read with the device awake and no clip playing.
enum BatteryLevel : uint8_t { BATT_OK = 0, BATT_LOW, BATT_VERY_LOW, BATT_EMPTY };

const uint16_t BATT_LOW_MV = 2400;       // 1.20 V a cell: volume capped at -3 dB
const uint16_t BATT_VERY_LOW_MV = 2200;  // 1.10 V a cell (the Rev A threshold per cell): -6 dB and the low-battery clip once
const uint16_t BATT_EMPTY_MV = 2000;     // 1.00 V a cell: no more clips, sleep only
const uint16_t BATT_HYST_MV = 60;

BatteryLevel batteryLevel(uint16_t millivolts, BatteryLevel previous);
// Gain in Q15 (32768 = full scale) for the user volume step (0, 1, 2 = 50 / 75 / 100 %) and the battery level.
int32_t gainQ15(uint8_t volumeStep, BatteryLevel level);
// The same for one clip class: the dark-hold clip plays a further 10 dB down (the lines' house rule: quiet in the hold).
int32_t clipGainQ15(ClipClass c, uint8_t volumeStep, BatteryLevel level);

}  // namespace bc

#endif  // BC_DETECT_H
