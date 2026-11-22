// BAGGAGE CLAIMS MK1 - detection core, Rev B (22 Nov 2026). See bc_detect.h.
#include "bc_detect.h"

#include <math.h>
#include <string.h>

namespace bc {

static const float PI_F = 3.14159265f;

static inline float len3(float x, float y, float z) { return sqrtf(x * x + y * y + z * z); }

static float angleDeg(float ax, float ay, float az, float bx, float by, float bz) {
  float la = len3(ax, ay, az), lb = len3(bx, by, bz);
  if (la < 1e-6f || lb < 1e-6f) return 0.0f;
  float c = (ax * bx + ay * by + az * bz) / (la * lb);
  if (c > 1.0f) c = 1.0f;
  if (c < -1.0f) c = -1.0f;
  return acosf(c) * 180.0f / PI_F;
}

const char* eventName(Event e) {
  switch (e) {
    case EV_THROW: return "THROW";
    case EV_FREEFALL: return "FREEFALL";
    case EV_LANDING: return "LANDING";
    case EV_IMPACT: return "IMPACT";
    case EV_CAROUSEL: return "CAROUSEL";
    case EV_WEIGH_IN: return "WEIGH_IN";
    case EV_GRAB: return "HANDLE_GRAB";
    case EV_CONVEYOR: return "CONVEYOR";
    case EV_INVERTED: return "INVERTED";
    default: return "NONE";
  }
}

Detector::Detector(const Config& cfg) : c_(cfg) {
  bx_ = by_ = bz_ = 0.0f;
  biasKnown_ = false;
  reset();
}

void Detector::reset() {
  now_ = 0;
  pending_ = 0;
  playing_ = false;
  gx_ = gy_ = 0.0f; gz_ = 1.0f;
  fx_ = fy_ = 0.0f; fz_ = 1.0f;
  rx_ = ry_ = 0.0f; rz_ = 1.0f;
  haveRest_ = false;
  started_ = false;
  wi_ = 0; wn_ = 0;
  for (int k = 0; k < 3; k++) sa_[k] = sa2_[k] = sg_[k] = sg2_[k] = 0.0;
  memset(wa_, 0, sizeof(wa_));
  memset(wg_, 0, sizeof(wg_));
  still_ = false;
  stillStart_ = 0;
  lastMotionMs_ = 0;
  lastStrongMs_ = 0;
  stillHadLift_ = false;
  for (int i = 0; i < HIST; i++) hist_[i] = 1.0f;
  hi_ = 0;
  lowRun_ = 0; lowGap_ = 0;
  flightReported_ = false; flightThrown_ = false;
  landingLeft_ = 0;
  flightEventMs_ = 0; hadFlight_ = false;
  lastImpactMs_ = 0; hadImpact_ = false;
  grabStage_ = 0; grabT0_ = 0; grabTilt_ = grabQuick_ = false;
  carrySamples_ = carryTilted_ = 0; carryWindows_ = carryGood_ = 0; carryStill_ = 0;
  secN_ = 0; secSum_ = secSum2_ = 0.0; secYaw_ = secOff_ = secGyro_ = 0.0;
  secPrev_ = 0.0f; secCross_ = 0; secHaveMean_ = false; secMeanPrev_ = 1.0f;
  rideScore_ = 0; rideReported_ = false; rideDeferred_ = 0;
  transportS_ = 0; yawPos_ = yawNeg_ = 0.0f; carouselReported_ = false;
  invertedMs_ = 0; invertedReported_ = false;
}

Event Detector::pop() {
  if (!pending_) return EV_NONE;
  for (uint8_t e = 1; e < EV_COUNT; e++) {
    if (pending_ & (1u << e)) {
      pending_ &= (uint16_t)~(1u << e);
      return (Event)e;
    }
  }
  pending_ = 0;
  return EV_NONE;
}

float Detector::tiltFromRestDeg() const {
  return haveRest_ ? angleDeg(fx_, fy_, fz_, rx_, ry_, rz_) : 0.0f;
}

Event Detector::update(const Sample& s) {
  now_ += SAMPLE_MS;
  const float am = len3(s.ax, s.ay, s.az);

  if (!started_) {
    started_ = true;
    const float n = am > 0.2f ? am : 1.0f;
    gx_ = fx_ = s.ax / n; gy_ = fy_ = s.ay / n; gz_ = fz_ = (am > 0.2f ? s.az / n : 1.0f);
    lastMotionMs_ = now_;
  }

  // ---- 0.5 s window: variance of the accelerometer and of the raw gyro (variance ignores the gyro's offset)
  const float a3[3] = {s.ax, s.ay, s.az};
  const float g3[3] = {s.gx, s.gy, s.gz};
  if (wn_ == WIN) {
    for (int k = 0; k < 3; k++) {
      sa_[k] -= wa_[wi_][k]; sa2_[k] -= (double)wa_[wi_][k] * wa_[wi_][k];
      sg_[k] -= wg_[wi_][k]; sg2_[k] -= (double)wg_[wi_][k] * wg_[wi_][k];
    }
  } else {
    wn_++;
  }
  for (int k = 0; k < 3; k++) {
    wa_[wi_][k] = a3[k]; wg_[wi_][k] = g3[k];
    sa_[k] += a3[k]; sa2_[k] += (double)a3[k] * a3[k];
    sg_[k] += g3[k]; sg2_[k] += (double)g3[k] * g3[k];
  }
  wi_ = (wi_ + 1) % WIN;
  float accVar = 1e9f, gyrVar = 1e9f;
  float gm[3] = {0, 0, 0};
  if (wn_ == WIN) {
    accVar = 0.0f; gyrVar = 0.0f;
    for (int k = 0; k < 3; k++) {
      const double ma = sa_[k] / WIN, mg = sg_[k] / WIN;
      double va = sa2_[k] / WIN - ma * ma, vg = sg2_[k] / WIN - mg * mg;
      if (va < 0) va = 0;
      if (vg < 0) vg = 0;
      accVar += (float)va; gyrVar += (float)vg;
      gm[k] = (float)mg;
    }
  }
  const bool quiet = accVar < c_.stillVarG2 && gyrVar < c_.stillGyroVar;

  // ---- gyro bias: learnt only while quiet, and never from a steady turn (a carousel is a steady turn)
  if (quiet) {
    if (!biasKnown_) {
      bx_ = gm[0]; by_ = gm[1]; bz_ = gm[2];
      biasKnown_ = true;
    } else if (len3(gm[0] - bx_, gm[1] - by_, gm[2] - bz_) < c_.biasGateDps) {
      const float k = 0.0005f;  // about 20 s
      bx_ += k * (gm[0] - bx_); by_ += k * (gm[1] - by_); bz_ += k * (gm[2] - bz_);
    }
  }
  float wx, wy, wz;
  if (biasKnown_) {
    wx = s.gx - bx_; wy = s.gy - by_; wz = s.gz - bz_;
  } else if (wn_ == WIN) {
    wx = s.gx - gm[0]; wy = s.gy - gm[1]; wz = s.gz - gm[2];
  } else {
    wx = wy = wz = 0.0f;
  }
  const float w = len3(wx, wy, wz);

  // ---- gravity: slow estimate while quasi-static, fast estimate always
  if (fabsf(am - 1.0f) < 0.12f && w < 40.0f) {
    gx_ += 0.02f * (s.ax - gx_); gy_ += 0.02f * (s.ay - gy_); gz_ += 0.02f * (s.az - gz_);
  }
  fx_ += 0.033f * (s.ax - fx_); fy_ += 0.033f * (s.ay - fy_); fz_ += 0.033f * (s.az - fz_);
  const float dyn = len3(s.ax - gx_, s.ay - gy_, s.az - gz_);
  if (dyn > c_.movingDynG || w > c_.movingGyroDps) lastMotionMs_ = now_;
  if (dyn >= c_.weighLiftG) lastStrongMs_ = now_;

  // ---- flight: |a| near zero, allowing for the spin of a tumbling bag
  const float wrad = w * PI_F / 180.0f;
  float spin = c_.flightSpinK * wrad * wrad;
  if (spin > c_.flightSpinMaxG) spin = c_.flightSpinMaxG;
  const bool low = am < c_.flightG + spin;
  if (low) {
    if (lowRun_ == 0) {
      float impulse = 0.0f, peak = 0.0f;
      const int n = c_.launchWindowMs / SAMPLE_MS < HIST ? c_.launchWindowMs / SAMPLE_MS : HIST;
      for (int i = 1; i <= n; i++) {
        const float h = hist_[(hi_ - i + 2 * HIST) % HIST];
        if (h > c_.launchDeadbandG) impulse += (h - c_.launchDeadbandG) * (SAMPLE_MS / 1000.0f);
        if (h > peak) peak = h;
      }
      flightThrown_ = impulse >= c_.launchImpulseGs || peak >= c_.launchPeakG;
      flightReported_ = false;
    }
    lowRun_++;
    lowGap_ = 0;
    if (!flightReported_ && (uint32_t)lowRun_ * SAMPLE_MS >= c_.flightMinMs) {
      queue(flightThrown_ ? EV_THROW : EV_FREEFALL);
      flightReported_ = true;
      flightEventMs_ = now_;
      hadFlight_ = true;
      grabStage_ = 0;
    }
  } else if (lowRun_ > 0) {
    lowGap_++;
    if (lowGap_ > c_.flightGapSamples || am >= c_.landingG) {
      if (flightReported_) landingLeft_ = c_.landingWindowMs;
      lowRun_ = 0;
      lowGap_ = 0;
    }
  }
  hist_[hi_] = am;
  hi_ = (hi_ + 1) % HIST;

  if (landingLeft_ > 0) {
    if (am >= c_.landingG) {
      queue(EV_LANDING);
      landingLeft_ = 0;
      lastImpactMs_ = now_;
      hadImpact_ = true;
    } else {
      landingLeft_ = landingLeft_ > SAMPLE_MS ? (uint16_t)(landingLeft_ - SAMPLE_MS) : 0;
    }
  }

  // ---- hard impact (not the end of a flight)
  if (am >= c_.impactG) {
    const bool afterFlight = hadFlight_ && now_ - flightEventMs_ < c_.impactAfterFlightMs;
    if (!afterFlight && (!hadImpact_ || now_ - lastImpactMs_ >= c_.impactRefractoryMs)) {
      queue(EV_IMPACT);
      lastImpactMs_ = now_;
      hadImpact_ = true;
    }
  }

  // ---- stillness, weigh-in, and the start of a grab
  if (!playing_) {
    const bool stillNow = quiet && w < c_.stillGyroDps && wn_ == WIN;
    if (stillNow && !still_) {
      still_ = true;
      stillStart_ = now_ > (uint32_t)(WIN * SAMPLE_MS) ? now_ - WIN * SAMPLE_MS : 0;
      stillHadLift_ = lastStrongMs_ != 0 && stillStart_ <= lastStrongMs_ + c_.weighLiftWithinMs;
    } else if (!stillNow && still_) {
      still_ = false;
      const uint32_t d = now_ - stillStart_;
      if (d >= c_.weighMinMs && d <= c_.weighMaxMs && stillHadLift_) queue(EV_WEIGH_IN);
      if (d >= c_.grabRestMs && haveRest_ && lowRun_ == 0) {
        grabStage_ = 1;
        grabT0_ = now_;
        grabTilt_ = grabQuick_ = false;
      }
    }
    if (still_ && now_ - stillStart_ >= c_.grabRestMs) {
      const float n = len3(gx_, gy_, gz_);
      if (n > 0.5f) {
        rx_ = gx_ / n; ry_ = gy_ / n; rz_ = gz_ / n;
        haveRest_ = true;
      }
    }
  }

  // ---- handle grab: tilt and quick motion from rest, then sustained tilt with steady carry motion
  if (grabStage_ == 1) {
    if (angleDeg(fx_, fy_, fz_, rx_, ry_, rz_) >= c_.grabTiltDeg) grabTilt_ = true;
    if (dyn >= c_.grabQuickG || w >= c_.grabQuickDps) grabQuick_ = true;
    if (grabTilt_ && grabQuick_) {
      grabStage_ = 2;
      carrySamples_ = carryTilted_ = 0;
      carryWindows_ = carryGood_ = 0;
      carryStill_ = 0;
    } else if (now_ - grabT0_ > c_.grabWindowMs) {
      grabStage_ = 0;
    }
  } else if (grabStage_ == 2 && !playing_) {
    carrySamples_++;
    if (angleDeg(fx_, fy_, fz_, rx_, ry_, rz_) >= c_.carryTiltDeg) carryTilted_++;
    if (still_ && ++carryStill_ > 100) grabStage_ = 0;  // put down again
    if (grabStage_ == 2 && (uint32_t)carrySamples_ * SAMPLE_MS >= c_.carryMs) {
      const bool tilted = (float)carryTilted_ >= c_.carryTiltShare * (float)carrySamples_;
      const bool carried = carryWindows_ > 0 && (float)carryGood_ >= c_.carryWindowShare * (float)carryWindows_;
      if (tilted && carried) queue(EV_GRAB);
      grabStage_ = 0;
    }
  }

  // ---- one-second statistics for the ride and the carousel
  if (!playing_) {
    const float gn = len3(gx_, gy_, gz_);
    float yaw = 0.0f;
    if (gn > 0.5f) yaw = (wx * gx_ + wy * gy_ + wz * gz_) / gn;
    float off2 = w * w - yaw * yaw;
    if (off2 < 0.0f) off2 = 0.0f;
    secSum_ += am; secSum2_ += (double)am * am;
    secYaw_ += yaw; secOff_ += sqrtf(off2); secGyro_ += w;
    const float dev = am - secMeanPrev_;
    if (fabsf(dev) > 0.02f) {
      const float sign = dev > 0 ? 1.0f : -1.0f;
      if (secPrev_ != 0.0f && sign != secPrev_ && secCross_ < 255) secCross_++;
      secPrev_ = sign;
    }
    if (++secN_ >= SAMPLE_HZ) secondWindow();
  }

  // ---- inverted
  if (lowRun_ == 0) {
    const float gn = len3(gx_, gy_, gz_);
    const float cosUp = gn > 0.5f ? (gx_ * c_.upX + gy_ * c_.upY + gz_ * c_.upZ) / gn : 0.0f;
    if (cosUp < c_.invertedCos) {
      if (invertedMs_ < 60000) invertedMs_ = (uint16_t)(invertedMs_ + SAMPLE_MS);
      if (invertedMs_ >= c_.invertedMs && !invertedReported_) {
        queue(EV_INVERTED);
        invertedReported_ = true;
      }
    } else if (cosUp > -0.5f) {
      invertedMs_ = 0;
      invertedReported_ = false;
    }
  }

  return pop();
}

void Detector::secondWindow() {
  const float mean = (float)(secSum_ / secN_);
  double var = secSum2_ / secN_ - (double)mean * mean;
  if (var < 0) var = 0;
  const float sd = sqrtf((float)var);
  const float yawMean = (float)(secYaw_ / secN_);
  const float offMean = (float)(secOff_ / secN_);
  const float gyroMean = (float)(secGyro_ / secN_);
  const uint8_t cross = secCross_;
  secN_ = 0; secSum_ = secSum2_ = 0.0; secYaw_ = secOff_ = secGyro_ = 0.0;
  secCross_ = 0; secPrev_ = 0.0f; secMeanPrev_ = mean;

  const bool flying = lowRun_ > 0;

  // carry: steady motion in the walking band
  if (grabStage_ == 2) {
    carryWindows_++;
    if (sd >= c_.carryStdMinG && sd <= c_.carryStdMaxG) carryGood_++;
  }

  // carousel: quiet transport that keeps turning one way about the vertical
  yawPos_ *= c_.carouselLeakPerS;
  yawNeg_ *= c_.carouselLeakPerS;
  const bool quietTransport = sd < c_.carouselStdMaxG && !flying && grabStage_ != 2;
  const float yawAbs = fabsf(yawMean);
  const bool turning = yawAbs >= c_.carouselYawMinDps && yawAbs <= c_.carouselYawMaxDps && offMean < c_.carouselOffAxisMaxDps;
  if (!quietTransport) {
    transportS_ = 0;
    yawPos_ = yawNeg_ = 0.0f;
    carouselReported_ = false;
  } else {
    if (sd >= 0.008f || turning) {
      if (transportS_ < 60000) transportS_++;
    }
    if (turning) {
      if (yawMean > 0) yawPos_ += yawAbs; else yawNeg_ += yawAbs;
    }
    const float net = fabsf(yawPos_ - yawNeg_), total = yawPos_ + yawNeg_;
    if (!carouselReported_ && transportS_ >= c_.carouselSeconds && net >= c_.carouselTurnDeg && total > 0.0f && net / total >= c_.carouselConsistency) {
      queue(EV_CAROUSEL);
      carouselReported_ = true;
    }
  }

  // conveyor or cart ride: steady vibration, faster than a walking rhythm, with little turning
  const bool ride = sd >= c_.rideStdMinG && sd <= c_.rideStdMaxG && gyroMean < c_.rideGyroMaxDps && cross >= c_.rideMinCrossings && grabStage_ != 2 && !flying;
  if (ride) {
    if (rideScore_ < 20) rideScore_++;
  } else {
    rideScore_ = (int8_t)(rideScore_ > 2 ? rideScore_ - 2 : 0);
    if (rideScore_ == 0) {
      rideReported_ = false;
      rideDeferred_ = 0;
    }
  }
  if (rideScore_ >= (int8_t)c_.rideSeconds && !rideReported_) {
    const bool maybeCarousel = fabsf(yawPos_ - yawNeg_) >= c_.rideYawDeferDeg && !carouselReported_ && rideDeferred_ < 12;
    if (maybeCarousel) {
      rideDeferred_++;
    } else {
      if (!carouselReported_) queue(EV_CONVEYOR);
      rideReported_ = true;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------

void Governor::noteMotion(uint64_t nowMs) {
  if (nowMs - s_->lastMotionMs > PHASE_RESET_MS) s_->usedMask = 0;
  s_->lastMotionMs = nowMs;
}

Governor::Verdict Governor::request(Event e, uint64_t nowMs, bool busy) {
  if (busy) return REFUSED_BUSY;
  const uint16_t bit = (uint16_t)(1u << e);
  if (s_->usedMask & bit) return REFUSED_CLASS_USED;
  if (s_->everPlayed && nowMs - s_->lastGagEndMs < COOLDOWN_MS) return REFUSED_COOLDOWN;
  if (!s_->everPlayed || nowMs - s_->hourStartMs > 3600000ULL) {
    s_->hourStartMs = nowMs;
    s_->gagsThisHour = 0;
  }
  if (s_->gagsThisHour >= MAX_PER_HOUR) return REFUSED_HOUR_CAP;
  s_->usedMask |= bit;
  s_->gagsThisHour++;
  s_->everPlayed = true;
  s_->lastGagEndMs = nowMs;
  return PLAY;
}

const char* Governor::verdictName(Verdict v) {
  switch (v) {
    case PLAY: return "play";
    case REFUSED_BUSY: return "refused: a clip is playing";
    case REFUSED_CLASS_USED: return "refused: this class already played in this journey phase";
    case REFUSED_COOLDOWN: return "refused: cooldown";
    default: return "refused: hourly cap";
  }
}

// ---------------------------------------------------------------------------------------------------------

const char* clipClassName(ClipClass c) {
  static const char* const NAMES[CLIP_CLASS_COUNT] = {"impact", "weigh", "grab", "freefall", "throw", "landing",
                                                      "carousel", "conveyor", "inverted", "idle", "lowbatt"};
  return c < CLIP_CLASS_COUNT ? NAMES[c] : "";
}

ClipClass clipClassFor(Event e) {
  switch (e) {
    case EV_THROW: return CLIP_THROW;
    case EV_FREEFALL: return CLIP_FREEFALL;
    case EV_LANDING: return CLIP_LANDING;
    case EV_CAROUSEL: return CLIP_CAROUSEL;
    case EV_WEIGH_IN: return CLIP_WEIGH;
    case EV_GRAB: return CLIP_GRAB;
    case EV_CONVEYOR: return CLIP_CONVEYOR;
    case EV_INVERTED: return CLIP_INVERTED;
    default: return CLIP_IMPACT;
  }
}

ClipClass clipFallback(ClipClass c) {
  if (c == CLIP_THROW) return CLIP_FREEFALL;
  if (c == CLIP_LANDING) return CLIP_IMPACT;
  return c;
}

uint8_t pickVariant(PickerState* st, ClipClass c, uint8_t count) {
  if (count == 0 || c >= CLIP_CLASS_COUNT) return 0;
  if (count == 1) {
    st->last[c] = 1;
    return 1;
  }
  uint32_t x = st->rng ? st->rng : 0x2545F491u;
  x ^= x << 13; x ^= x >> 17; x ^= x << 5;
  st->rng = x;
  uint8_t v = (uint8_t)(1 + x % count);
  if (v == st->last[c]) v = (uint8_t)(v % count + 1);
  st->last[c] = v;
  return v;
}

// ---------------------------------------------------------------------------------------------------------

BatteryLevel batteryLevel(uint16_t mv, BatteryLevel previous) {
  static const uint16_t FLOOR[3] = {BATT_LOW_MV, BATT_VERY_LOW_MV, BATT_EMPTY_MV};
  for (uint8_t level = BATT_OK; level < BATT_EMPTY; level++) {
    const uint16_t th = (uint16_t)(FLOOR[level] + (previous > level ? BATT_HYST_MV : 0));
    if (mv >= th) return (BatteryLevel)level;
  }
  return BATT_EMPTY;
}

int32_t gainQ15(uint8_t volumeStep, BatteryLevel level) {
  static const int32_t VOL[3] = {10362, 18427, 32768};  // -10 dB, -5 dB, 0 dB
  int32_t g = VOL[volumeStep > 2 ? 2 : volumeStep];
  if (level == BATT_LOW) g = (g * 23198) >> 15;        // -3 dB
  else if (level == BATT_VERY_LOW) g = (g * 16423) >> 15;  // -6 dB
  else if (level == BATT_EMPTY) g = 0;
  return g;
}

}  // namespace bc
