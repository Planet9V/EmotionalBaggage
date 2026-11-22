// Host tests of the Baggage Claims MK1 detection core (seed/concepts/baggage-claims/files/bc_detect.{h,cpp}).
// Built with g++ and run on the development machine: no Arduino, no sensor. Each test feeds the detector a
// synthetic 100 Hz trace and asserts the events it reports. The traces are made from the physics the design
// note describes (docs/design/baggage-claims-device.md, section 3); they are NOT recordings of real luggage.
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <functional>
#include <string>
#include <vector>

#include "bc_detect.h"

using namespace bc;

static int failures = 0;
#define CHECK(cond, what)                                                         \
  do {                                                                            \
    if (!(cond)) {                                                                \
      failures++;                                                                 \
      std::printf("    FAIL %s:%d  %s\n", __FILE__, __LINE__, what);              \
    }                                                                             \
  } while (0)

struct V3 { float x, y, z; };
static V3 norm(V3 v) { float n = std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z); return {v.x / n, v.y / n, v.z / n}; }
static const float PI = 3.14159265f;

// A deterministic noise source (no <random>, so the trace is the same on every machine).
struct Rng {
  uint32_t s = 12345;
  float uni() { s = s * 1664525u + 1013904223u; return (float)((s >> 8) & 0xFFFFFF) / 16777216.0f; }
  float gauss() { float a = 0; for (int i = 0; i < 12; i++) a += uni(); return a - 6.0f; }
};

struct Trace {
  std::vector<Sample> s;
  Rng rng;
  V3 bias{3.0f, -2.0f, 1.5f};       // gyro zero-rate offset, deg/s (the part allows up to 20)
  float accNoise = 0.004f, gyrNoise = 0.1f;
  // accel = what the accelerometer reads in g (gravity included); gyro in deg/s, before bias and noise
  void add(int ms, const std::function<void(float t, V3& acc, V3& gyro)>& f) {
    for (int i = 0; i < ms / SAMPLE_MS; i++) {
      V3 a{0, 0, 1}, g{0, 0, 0};
      f(i * SAMPLE_MS / 1000.0f, a, g);
      Sample o;
      o.ax = a.x + accNoise * rng.gauss(); o.ay = a.y + accNoise * rng.gauss(); o.az = a.z + accNoise * rng.gauss();
      o.gx = g.x + bias.x + gyrNoise * rng.gauss(); o.gy = g.y + bias.y + gyrNoise * rng.gauss(); o.gz = g.z + bias.z + gyrNoise * rng.gauss();
      s.push_back(o);
    }
  }
  void rest(int ms, V3 up = {0, 0, 1}) { add(ms, [=](float, V3& a, V3&) { a = up; }); }
  // broadband vibration about `up`, standard deviation sd g on each axis
  void vibrate(int ms, float sd, V3 up = {0, 0, 1}, V3 turn = {0, 0, 0}) {
    add(ms, [=](float, V3& a, V3& g) { a = {up.x + sd * rng.gauss(), up.y + sd * rng.gauss(), up.z + sd * rng.gauss()}; g = turn; });
  }
  // walking: a 1.8 Hz bounce along `up` with a little sway
  void walk(int ms, V3 up, float amp = 0.22f) {
    add(ms, [=](float t, V3& a, V3& g) {
      float b = amp * std::sin(2 * PI * 1.8f * t), sway = 0.06f * std::sin(2 * PI * 0.9f * t);
      a = {up.x * (1 + b) + sway, up.y * (1 + b), up.z * (1 + b)};
      g = {8.0f * std::sin(2 * PI * 0.9f * t), 5.0f * std::sin(2 * PI * 1.8f * t), 0};
    });
  }
  // half-sine bump of `peak` g along `up` lasting ms
  void bump(int ms, float peak, V3 up = {0, 0, 1}) {
    add(ms, [=](float t, V3& a, V3&) { float k = 1 + (peak - 1) * std::sin(PI * t / (ms / 1000.0f)); a = {up.x * k, up.y * k, up.z * k}; });
  }
};

struct Seen { Event e; uint32_t ms; };

static std::vector<Seen> run(const Trace& t, Detector* keep = nullptr) {
  Detector local;
  Detector& d = keep ? *keep : local;
  std::vector<Seen> out;
  for (const Sample& x : t.s) {
    Event e = d.update(x);
    if (e != EV_NONE) out.push_back({e, d.nowMs()});
  }
  // drain anything still queued
  return out;
}

static int count(const std::vector<Seen>& v, Event e) { int n = 0; for (auto& x : v) if (x.e == e) n++; return n; }
static uint32_t when(const std::vector<Seen>& v, Event e) { for (auto& x : v) if (x.e == e) return x.ms; return 0; }
static std::string names(const std::vector<Seen>& v) {
  std::string s;
  for (auto& x : v) { char b[64]; std::snprintf(b, sizeof b, "%s@%.2fs ", eventName(x.e), x.ms / 1000.0); s += b; }
  return s.empty() ? "(none)" : s;
}
static bool only(const std::vector<Seen>& v, std::initializer_list<Event> allowed) {
  for (auto& x : v) { bool ok = false; for (Event a : allowed) if (a == x.e) ok = true; if (!ok) return false; }
  return true;
}

#define TEST(name) static void name(); static struct Reg_##name { Reg_##name() { tests().push_back({#name, name}); } } reg_##name; static void name()
struct T { const char* n; void (*f)(); };
static std::vector<T>& tests() { static std::vector<T> t; return t; }

// ------------------------------------------------------------------------------------------------ flights

// A throw: at rest, a 0.35 s swing (2.3 g, turning), 0.45 s in the air tumbling at 200 deg/s with the tag
// 0.3 m off the spin axis (so it reads about 0.37 g, not zero), a 9 g landing, then rest.
TEST(a_throw_is_a_throw_and_its_landing_not_a_drop_or_an_impact) {
  Trace t;
  t.rest(2000);
  t.add(350, [](float tt, V3& a, V3& g) { float k = std::sin(PI * tt / 0.35f); a = {0.5f * k, 0, 1 + 1.3f * k}; g = {150 * k, 0, 0}; });
  t.add(450, [](float, V3& a, V3& g) { a = {0.37f, 0, 0}; g = {200, 0, 0}; });
  t.bump(40, 9.0f);
  t.rest(3000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_THROW) == 1, "one THROW");
  CHECK(count(ev, EV_LANDING) == 1, "one LANDING");
  CHECK(count(ev, EV_FREEFALL) == 0, "not a FREEFALL");
  CHECK(count(ev, EV_IMPACT) == 0, "the landing is not a separate hard impact");
  CHECK(only(ev, {EV_THROW, EV_LANDING}), "nothing else");
  // reported 0.3 s into the flight (the flight begins at 2.35 s)
  CHECK(when(ev, EV_THROW) >= 2640 && when(ev, EV_THROW) <= 2700, "THROW reported about 0.3 s after release");
  CHECK(when(ev, EV_LANDING) > when(ev, EV_THROW), "LANDING after THROW");
}

// The Rev A rule (|a| < 0.15 g) would not see that throw: the spin keeps the reading at 0.37 g.
TEST(the_rev_a_free_fall_rule_would_miss_a_tumbling_throw) {
  Config c;
  c.flightG = 0.15f; c.flightSpinK = 0.0f; c.flightSpinMaxG = 0.0f;
  Detector d(c);
  Trace t;
  t.rest(2000);
  t.add(350, [](float tt, V3& a, V3& g) { float k = std::sin(PI * tt / 0.35f); a = {0.5f * k, 0, 1 + 1.3f * k}; g = {150 * k, 0, 0}; });
  t.add(450, [](float, V3& a, V3& g) { a = {0.37f, 0, 0}; g = {200, 0, 0}; });
  t.bump(40, 9.0f);
  t.rest(1000);
  auto ev = run(t, &d);
  std::printf("    events with the Rev A rule: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_THROW) == 0 && count(ev, EV_FREEFALL) == 0, "no flight seen with a fixed 0.15 g limit");
}

// A drop: slides off a ledge from rest (no launch), 0.40 s of free fall (0.78 m), a 12 g landing.
TEST(a_drop_is_a_free_fall_not_a_throw) {
  Trace t;
  t.rest(2500);
  t.add(400, [](float, V3& a, V3& g) { a = {0.02f, 0.01f, 0.03f}; g = {25, 10, 0}; });
  t.bump(30, 12.0f);
  t.rest(3000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_FREEFALL) == 1, "one FREEFALL");
  CHECK(count(ev, EV_THROW) == 0, "not a THROW");
  CHECK(count(ev, EV_LANDING) == 1, "one LANDING");
  CHECK(count(ev, EV_IMPACT) == 0, "no separate IMPACT");
  CHECK(when(ev, EV_FREEFALL) >= 2790 && when(ev, EV_FREEFALL) <= 2830, "FREEFALL reported 0.3 s into the fall");
}

// A fall of 0.20 s (0.2 m) is under the 0.3 s rule: no flight event. Its 9 g landing is a hard impact.
TEST(a_short_fall_is_only_a_hard_impact) {
  Trace t;
  t.rest(2000);
  t.add(200, [](float, V3& a, V3&) { a = {0.02f, 0, 0.02f}; });
  t.bump(30, 9.0f);
  t.rest(2000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_IMPACT) == 1, "one IMPACT");
  CHECK(only(ev, {EV_IMPACT}), "nothing else");
}

// Carried, lowered (0.75 g for 0.25 s), set down with a 2.5 g bump, left alone: nothing.
TEST(a_set_down_is_not_a_flight_an_impact_or_a_weigh_in) {
  Trace t;
  t.walk(3000, {0, 0, 1});
  t.add(250, [](float, V3& a, V3&) { a = {0, 0, 0.75f}; });
  t.bump(40, 2.5f);
  t.rest(10000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(ev.empty(), "no event");
}

// The tag swinging on its loop and slapping the case while the bag is carried: short 3.5 g knocks. Nothing.
TEST(the_tag_knocking_the_case_is_not_a_hard_impact) {
  Trace t;
  t.rest(1500);
  for (int i = 0; i < 6; i++) { t.walk(900, {0, 0, 1}); t.bump(20, 3.5f); }
  t.rest(1500);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_IMPACT) == 0 && count(ev, EV_THROW) == 0 && count(ev, EV_FREEFALL) == 0, "no impact and no flight");
}

// A 10 g knock at rest (dropped object, kick): the documents' hard impact.
TEST(a_hard_knock_at_rest_is_a_hard_impact_once) {
  Trace t;
  t.rest(2000);
  t.bump(30, 10.0f);
  t.bump(30, 7.0f);   // the bounce, inside the 1 s refractory time
  t.rest(2000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_IMPACT) == 1, "one IMPACT");
  CHECK(only(ev, {EV_IMPACT}), "nothing else");
}

// --------------------------------------------------------------------------------------- conveyor, carousel

// A belt: 12 s of broadband vibration (0.08 g on each axis), a few jolts, no turning.
TEST(conveyor_vibration_is_a_conveyor_and_never_a_flight) {
  Trace t;
  t.rest(1500);
  for (int i = 0; i < 4; i++) { t.vibrate(2900, 0.08f); t.bump(100, 1.6f); }
  t.rest(2000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CONVEYOR) == 1, "one CONVEYOR");
  CHECK(only(ev, {EV_CONVEYOR}), "nothing else: no flight, impact, grab or carousel");
  CHECK(when(ev, EV_CONVEYOR) >= 8000 && when(ev, EV_CONVEYOR) <= 12500, "after about 8 s of ride");
}

// A racetrack carousel at 0.45 m/s: 6 s straight, an end bend of 1.2 m radius (21 deg/s for 8.5 s, 180
// degrees), 20 s straight, the second bend the same way. Smooth (0.02 g). Centripetal 0.017 g is included.
TEST(a_racetrack_carousel_is_reported_once_after_15_s) {
  Trace t;
  t.rest(1200);
  t.bump(60, 1.5f);  // put on the belt
  auto straight = [&](int ms) { t.vibrate(ms, 0.02f); };
  auto bend = [&](int ms) { t.vibrate(ms, 0.02f, {0.017f, 0, 1}, {0, 0, 21}); };
  straight(6000); bend(8500); straight(20000); bend(8500); straight(6000);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CAROUSEL) == 1, "one CAROUSEL");
  CHECK(only(ev, {EV_CAROUSEL}), "nothing else");
  // the bend reaches 120 degrees 11.7 s into the ride; the 15 s rule holds the report until 15 s of ride
  CHECK(when(ev, EV_CAROUSEL) >= 15500 && when(ev, EV_CAROUSEL) <= 18500, "reported once 15 s of ride and 120 degrees of turn are both there");
}

// A round carousel: a steady 9 deg/s (0.45 m/s on a 2.9 m radius), smooth.
TEST(a_round_carousel_is_reported_and_its_turn_is_not_learnt_as_gyro_bias) {
  Trace t;
  t.rest(2000);
  t.vibrate(30000, 0.012f, {0.007f, 0, 1}, {0, 0, -9});
  Detector d;
  auto ev = run(t, &d);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CAROUSEL) == 1, "one CAROUSEL");
  float bx, by, bz; d.gyroBias(bx, by, bz);
  CHECK(std::fabs(bz - t.bias.z) < 1.0f, "the gyro bias still reads the offset, not the turn");
}

// A rough carousel (0.06 g vibration): the ride waits for the carousel decision instead of saying "conveyor" first.
TEST(a_rough_carousel_is_a_carousel_not_a_conveyor_then_a_carousel) {
  Trace t;
  t.rest(1200);
  t.vibrate(3000, 0.06f);
  t.vibrate(8500, 0.06f, {0.017f, 0, 1}, {0, 0, 21});
  t.vibrate(12000, 0.06f);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CAROUSEL) == 1, "one CAROUSEL");
  CHECK(count(ev, EV_CONVEYOR) == 0, "no CONVEYOR");
}

// A straight belt with one 90 degree corner is a conveyor, not a carousel.
TEST(one_right_angle_corner_is_not_a_carousel) {
  Trace t;
  t.rest(1200);
  t.vibrate(5000, 0.05f);
  t.vibrate(4500, 0.05f, {0, 0, 1}, {0, 0, 20});
  t.vibrate(14000, 0.05f);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CAROUSEL) == 0, "no CAROUSEL");
  CHECK(count(ev, EV_CONVEYOR) == 1, "one CONVEYOR");
}

// A left turn then a right turn (a cart weaving): the turns cancel, so no carousel.
TEST(opposite_turns_cancel) {
  Trace t;
  t.rest(1200);
  for (int i = 0; i < 3; i++) {
    t.vibrate(4500, 0.02f, {0, 0, 1}, {0, 0, 20});
    t.vibrate(4500, 0.02f, {0, 0, 1}, {0, 0, -20});
  }
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_CAROUSEL) == 0, "no CAROUSEL");
}

// --------------------------------------------------------------------------------------- handle grab, weigh-in

// Handle grab: at rest upright; grabbed and tipped 30 degrees in half a second (80 deg/s, 0.4 g); carried 8 s
// at that tilt with a walking bounce.
TEST(a_handle_grab_is_reported_after_four_seconds_of_tilted_carry) {
  Trace t;
  t.rest(3000);
  t.add(500, [](float tt, V3& a, V3& g) {
    float ang = 30.0f * (tt / 0.5f) * PI / 180.0f;
    a = {std::sin(ang) + 0.4f * std::sin(PI * tt / 0.5f), 0, std::cos(ang)};
    g = {0, 80, 0};
  });
  V3 up = norm({std::sin(30 * PI / 180), 0, std::cos(30 * PI / 180)});
  t.walk(8000, up);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_GRAB) == 1, "one HANDLE_GRAB");
  CHECK(only(ev, {EV_GRAB}), "nothing else (walking is not a conveyor)");
  CHECK(when(ev, EV_GRAB) >= 7000 && when(ev, EV_GRAB) <= 8200, "about 4 s after the grab at 3.0 s");
}

// Knocked over (tips 80 degrees, quick), then lies still: tilt and quick motion but no carry.
TEST(knocked_over_and_left_is_not_a_handle_grab) {
  Trace t;
  t.rest(3000);
  t.add(600, [](float tt, V3& a, V3& g) { float ang = 80.0f * (tt / 0.6f) * PI / 180.0f; a = {std::sin(ang), 0, std::cos(ang)}; g = {0, 133, 0}; });
  t.bump(40, 2.2f, norm({std::sin(80 * PI / 180), 0, std::cos(80 * PI / 180)}));
  t.rest(9000, norm({std::sin(80 * PI / 180), 0, std::cos(80 * PI / 180)}));
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_GRAB) == 0, "no HANDLE_GRAB");
}

// Weigh-in: at rest; lifted onto the scale (0.6 s, 0.4 g, no lasting tilt); dead still 4.5 s; the belt starts.
TEST(a_weigh_in_is_lift_then_still_then_moved) {
  Trace t;
  t.rest(2000);
  t.add(600, [](float tt, V3& a, V3& g) { a = {0.1f * std::sin(2 * PI * tt / 0.6f), 0, 1 + 0.4f * std::sin(2 * PI * tt / 0.6f)}; g = {10 * std::sin(PI * tt / 0.6f), 0, 0}; });
  t.rest(4500);
  t.vibrate(3000, 0.06f);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_WEIGH_IN) == 1, "one WEIGH_IN");
  CHECK(count(ev, EV_GRAB) == 0, "not a HANDLE_GRAB");
  CHECK(when(ev, EV_WEIGH_IN) >= 7000 && when(ev, EV_WEIGH_IN) <= 7400, "reported when the stillness ends");
}

// Put down and left for 12 s, then moved: too long for a weigh-in.
TEST(left_for_twelve_seconds_is_not_a_weigh_in) {
  Trace t;
  t.rest(2000);
  t.add(600, [](float tt, V3& a, V3&) { a = {0, 0, 1 + 0.4f * std::sin(2 * PI * tt / 0.6f)}; });
  t.rest(12000);
  t.vibrate(2000, 0.06f);
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_WEIGH_IN) == 0, "no WEIGH_IN");
}

// Still for 4.5 s with nothing before it (the device woke on a nudge): no lift, so no weigh-in.
TEST(still_without_a_lift_before_it_is_not_a_weigh_in) {
  Trace t;
  t.rest(8000);
  t.rest(4500);
  t.vibrate(2000, 0.06f);
  auto ev = run(t);
  CHECK(count(ev, EV_WEIGH_IN) == 0, "no WEIGH_IN");
}

// While a clip plays the speaker shakes the sensor: stillness and the ride hold their state.
TEST(speaker_vibration_during_playback_starts_nothing) {
  Detector d;
  Trace t;
  t.rest(3000);
  t.vibrate(10000, 0.08f);
  std::vector<Seen> ev;
  for (size_t i = 0; i < t.s.size(); i++) {
    d.setPlaying(i >= 300);
    Event e = d.update(t.s[i]);
    if (e != EV_NONE) ev.push_back({e, d.nowMs()});
  }
  CHECK(ev.empty(), "no event from the speaker's own vibration");
}

// Upside down for five seconds (the tag's up axis is +Y in the default configuration).
TEST(inverted_for_more_than_four_seconds) {
  Trace t;
  t.rest(2000, {0, 1, 0});
  t.add(800, [](float tt, V3& a, V3& g) { float ang = PI * tt / 0.8f; a = {std::sin(ang), std::cos(ang), 0}; g = {0, 0, 225}; });
  t.rest(6000, {0, -1, 0});
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  CHECK(count(ev, EV_INVERTED) == 1, "one INVERTED");
}

// ------------------------------------------------------------------------------- governor, picker, battery

TEST(governor_one_per_class_per_phase_cooldown_and_six_an_hour) {
  GovernorState s{};
  Governor g(&s);
  uint64_t t = 1000;
  g.noteMotion(t);
  CHECK(g.request(EV_IMPACT, t, false) == Governor::PLAY, "first impact plays");
  g.notePlaybackEnd(t + 2000);
  CHECK(g.request(EV_GRAB, t + 3000, false) == Governor::REFUSED_COOLDOWN, "1 s after the clip ended: cooldown");
  CHECK(g.request(EV_IMPACT, t + 9000, false) == Governor::REFUSED_CLASS_USED, "second impact in the phase is refused");
  CHECK(g.request(EV_GRAB, t + 9000, true) == Governor::REFUSED_BUSY, "refused while a clip plays");
  Event more[] = {EV_GRAB, EV_WEIGH_IN, EV_CONVEYOR, EV_CAROUSEL, EV_THROW};
  uint64_t at = t + 10000;
  for (Event e : more) { CHECK(g.request(e, at, false) == Governor::PLAY, "plays"); g.notePlaybackEnd(at + 2000); at += 10000; }
  CHECK(g.request(EV_FREEFALL, at, false) == Governor::REFUSED_HOUR_CAP, "the seventh in the hour is refused");
  // 61 minutes without motion: a new journey phase, and the hour has rolled over
  at += 61ULL * 60 * 1000;
  g.noteMotion(at);
  CHECK(g.request(EV_IMPACT, at, false) == Governor::PLAY, "a new phase plays impact again");
}

// The running gags of the lines (docs/design/baggage-claims-lines.md): the bag counts impacts in a journey
// ("That's one", "That's two", "Too many") and carousel laps ("lap two", "third lap").
TEST(governor_lets_a_counted_class_play_once_per_count_step) {
  GovernorState s{};
  Governor g(&s);
  uint64_t at = 1000;
  g.noteMotion(at);
  for (int i = 1; i <= 5; i++) {
    g.noteEvent(EV_IMPACT);
    const Governor::Verdict v = g.request(EV_IMPACT, at, false);
    if (i <= 3) CHECK(v == Governor::PLAY && g.countStep(EV_IMPACT) == i, "impacts one, two and three (too many) each play");
    else CHECK(v == Governor::REFUSED_CLASS_USED && g.countStep(EV_IMPACT) == 3, "after too many, nothing more this phase");
    g.notePlaybackEnd(at + 2000);
    at += 10000;
  }
  // an impact refused (busy) still counts, so the next one that plays says the right number
  g.noteMotion(at + 61ULL * 60 * 1000);
  at += 61ULL * 60 * 1000;
  CHECK(g.countStep(EV_IMPACT) == 0, "a new journey phase starts the count again");
  g.noteEvent(EV_IMPACT);
  CHECK(g.request(EV_IMPACT, at, true) == Governor::REFUSED_BUSY, "busy");
  g.noteEvent(EV_LANDING);
  CHECK(g.countStep(EV_IMPACT) == 2 && g.request(EV_LANDING, at, false) == Governor::PLAY, "a landing counts as an impact: this is two");
  CHECK(g.countStep(EV_GRAB) == 0, "a grab is not counted");
}

// A round carousel for over two minutes: the first report after 15 s and 120 degrees, then one at each further lap.
TEST(a_long_carousel_ride_is_reported_again_at_each_further_lap) {
  Trace t;
  t.rest(2000);
  t.vibrate(130000, 0.012f, {0.007f, 0, 1}, {0, 0, 9});
  auto ev = run(t);
  std::printf("    events: %s\n", names(ev).c_str());
  // 9 deg/s for 130 s is 1170 degrees: reports at about 120, 480 and 840
  CHECK(count(ev, EV_CAROUSEL) == 3, "three CAROUSEL: the ride, lap two, lap three");
  CHECK(only(ev, {EV_CAROUSEL}), "nothing else");
}

TEST(clip_plan_and_quiet_dark_hold) {
  CHECK(std::string(clipClassName(CLIP_BOX)) == "box" && std::string(clipClassName(CLIP_NAME)) == "name", "stems for the first start and the pack name");
  CHECK(clipGainQ15(CLIP_IDLE, 2, BATT_OK) < gainQ15(2, BATT_OK) / 3 + 100, "the dark-hold clip plays 10 dB down");
  CHECK(clipGainQ15(CLIP_IMPACT, 2, BATT_OK) == gainQ15(2, BATT_OK), "other clips at the volume step");
  CHECK(clipGainQ15(CLIP_IDLE, 2, BATT_EMPTY) == 0, "silent when empty");
}

TEST(picker_never_repeats_a_variant_twice_running) {
  PickerState p{};
  p.rng = 99;
  uint8_t last = 0;
  bool seen[4] = {false, false, false, false};
  for (int i = 0; i < 500; i++) {
    uint8_t v = pickVariant(&p, CLIP_IMPACT, 3);
    CHECK(v >= 1 && v <= 3, "in range");
    CHECK(v != last, "not the one before");
    seen[v] = true; last = v;
  }
  CHECK(seen[1] && seen[2] && seen[3], "all three variants are used");
  CHECK(pickVariant(&p, CLIP_WEIGH, 1) == 1 && pickVariant(&p, CLIP_WEIGH, 1) == 1, "a single variant repeats (there is no other)");
  CHECK(pickVariant(&p, CLIP_IDLE, 0) == 0, "no clip, no variant");
  CHECK(clipFallback(CLIP_THROW) == CLIP_FREEFALL && clipFallback(CLIP_LANDING) == CLIP_IMPACT, "fallbacks");
}

TEST(battery_levels_and_volume) {
  CHECK(batteryLevel(3000, BATT_OK) == BATT_OK, "fresh cells");
  CHECK(batteryLevel(2390, BATT_OK) == BATT_LOW, "below 2.40 V");
  CHECK(batteryLevel(2420, BATT_LOW) == BATT_LOW, "hysteresis: 2.42 V does not go back to OK");
  CHECK(batteryLevel(2470, BATT_LOW) == BATT_OK, "2.47 V does");
  CHECK(batteryLevel(2150, BATT_LOW) == BATT_VERY_LOW, "below 2.20 V");
  CHECK(batteryLevel(1990, BATT_VERY_LOW) == BATT_EMPTY, "below 2.00 V");
  CHECK(gainQ15(2, BATT_OK) == 32768, "full volume");
  CHECK(gainQ15(2, BATT_LOW) < 24000 && gainQ15(2, BATT_LOW) > 22000, "-3 dB when low");
  CHECK(gainQ15(2, BATT_EMPTY) == 0, "silent when empty");
  CHECK(gainQ15(0, BATT_OK) < gainQ15(1, BATT_OK) && gainQ15(1, BATT_OK) < gainQ15(2, BATT_OK), "three volume steps");
}

int main() {
  int ran = 0, failed = 0;
  for (auto& t : tests()) {
    int before = failures;
    std::printf("%s\n", t.n);
    t.f();
    ran++;
    if (failures != before) { failed++; std::printf("  => FAILED\n"); } else std::printf("  => ok\n");
  }
  std::printf("\n%d tests, %d failed\n", ran, failed);
  return failed ? 1 : 0;
}
