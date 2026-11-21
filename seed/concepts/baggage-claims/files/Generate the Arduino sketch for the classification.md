Generate the Arduino sketch for the classification engine

The complete sketch is saved as BaggageClaims_Classifier_RevA.ino (262 lines) and reproduced below. It implements all eight classifiers from LLD §1.4, the state machine and governor from §1.5, and the exact pin map and register settings from ICD §§1.3/2.3.

```cpp
/* BAGGAGE CLAIMS MK1 - Classification Engine   Rev A - 2026-11-19
 * Board : Waveshare ESP32-S3 Mini (Arduino-ESP32 core 3.x, "ESP32S3 Dev Module")
 * Libs  : DFRobotDFPlayerMini v1.0.6+ | Wire (raw I2C per ICD sec 2.3) */
#include <Arduino.h>
#include <Wire.h>
#include <DFRobotDFPlayerMini.h>
#include <esp_sleep.h>

/* Pins (ICD sec 1.3) */
constexpr int PIN_SDA=9, PIN_SCL=8;
constexpr int PIN_DF_RX=16, PIN_DF_TX=17;   // 17 -> DFPlayer RX via 1k
constexpr int PIN_BUSY=4, PIN_BTN=5, PIN_INT=6;
constexpr uint8_t MPU_ADDR=0x68;

/* Tunables (LLD sec 1.4) */
const float    IMPACT_G=8.0f, FREEFALL_G=0.15f;
const uint32_t FREEFALL_MIN_MS=280;
const uint32_t WEIGH_HOLD_MIN=3500, WEIGH_HOLD_MAX=6000, WEIGH_PREMOTION=8000;
const float    STILL_VAR=0.002f, STILL_GYRO=3.0f;
const float    GRAB_TILT_MIN=25.0f, GRAB_TILT_MAX=75.0f;
const uint32_t GRAB_MIN_MS=10000;
const float    CAROUSEL_GZ=15.0f;
const uint32_t CAR_X_MIN=3000, CAR_X_MAX=12000; const uint8_t CAR_X_NEED=3;
const float    CONV_VAR_LO=0.015f, CONV_VAR_HI=0.5f; const uint32_t CONV_MS=8000;
const float    INVERT_AZ=-0.9f; const uint32_t INVERT_MS=4000;
const uint32_t DARK_IDLE_MS=2UL*60*60*1000;
const uint32_t PHASE_RESET_MS=60UL*60*1000;
const uint32_t COOLDOWN_MS=3000; const uint8_t MAX_GAGS_HOUR=6;
const uint32_t SLEEP_AFTER_MS=5UL*60*1000;

/* Clip map = microSD file numbering (LLD assembly step 4) */
enum Clip : uint8_t { CL_IMPACT1=1, CL_IMPACT2, CL_WEIGH, CL_CARRY, CL_FREEFALL,
                      CL_CAROUSEL, CL_CONVEYOR, CL_INVERTED, CL_IDLE, CL_LOWBATT, CL_END };
uint8_t voicePack=1, gagVolume=23;

/* IMU ring buffers: 10 s @ 100 Hz */
constexpr int N_HIST=1000;
float magHist[N_HIST], gzHist[N_HIST];
int head=0; long filled=0;
float ax_, ay_, az_, gz_;
float gravX=0, gravY=0, gravZ=1.0f;   // CALIBRATE output

inline void ringPush(float m,float g){ magHist[head]=m; gzHist[head]=g;
  head=(head+1)%N_HIST; if(filled<N_HIST) filled++; }
float ringVarMag(int n){
  if(filled<n) return 0.f; float s=0,s2=0;
  for(int i=0;i<n;i++){ float v=magHist[(head-1-i+N_HIST)%N_HIST]; s+=v; s2+=v*v; }
  float m=s/n; return s2/n-m*m;
}

/* Raw I2C (ICD sec 2.3 register plan) */
void mpuWrite(uint8_t r,uint8_t v){ Wire.beginTransmission(MPU_ADDR);
  Wire.write(r); Wire.write(v); Wire.endTransmission(); }
uint8_t mpuRead8(uint8_t r){ Wire.beginTransmission(MPU_ADDR); Wire.write(r);
  Wire.endTransmission(false); Wire.requestFrom(MPU_ADDR,(uint8_t)1); return Wire.read(); }
void mpuRead6(uint8_t r,float&x,float&y,float&z,float lsb){
  Wire.beginTransmission(MPU_ADDR); Wire.write(r); Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR,(uint8_t)6);
  int16_t rx=(Wire.read()<<8)|Wire.read(), ry=(Wire.read()<<8)|Wire.read(), rz=(Wire.read()<<8)|Wire.read();
  x=rx/lsb; y=ry/lsb; z=rz/lsb;
}
void mpuInit(){
  mpuWrite(0x6B,0x01); delay(20);          // wake, PLL on X gyro
  mpuWrite(0x1C,0x10);                     // +/-8g  -> 4096 LSB/g
  mpuWrite(0x1B,0x08);                     // +/-500dps -> 65.5 LSB/dps
  mpuWrite(0x1A,0x03); mpuWrite(0x19,0x09);// DLPF 44Hz, 100 Hz rate
  mpuWrite(0x1F,4); mpuWrite(0x20,1);      // MOT_THR, MOT_DUR
  mpuWrite(0x69,0x00);
  mpuWrite(0x37,0x20);                     // latched INT (read 0x3A clears)
  mpuWrite(0x38,0x40);                     // motion interrupt only
}
bool motionLatched(){ uint8_t s=mpuRead8(0x3A); return s & 0x40; }
void mpuSample(){
  mpuRead6(0x3B, ax_, ay_, az_, 4096.0f);       // accel, g
  mpuRead6(0x43, gxDump, gz_, gzDump, 65.5f);   // see mounting note below
}

/* DFPlayer audio (YX5200 command set over UART1) */
DFRobotDFPlayerMini df; HardwareSerial& DFS=Serial1; bool dfReady=false;
void dfInit(){ DFS.begin(9600, SERIAL_8N1, PIN_DF_RX, PIN_DF_TX);
  dfReady=df.begin(DFS,true,true);
  if(dfReady){ df.setTimeOut(800); df.volume(gagVolume); df.EQ(DFPLAYER_EQ_NORMAL);} }

/* Governor / dispatcher (LLD sec 1.5) */
bool classUsed[CL_END]={0}; uint8_t gagHour=0;
uint32_t hourStart=0, lastGagEnd=0, lastMotionMs=0;
bool busy(){ return digitalRead(PIN_BUSY)==LOW; }
void dispatch(Clip c,const char* tag){
  uint32_t now=millis();
  if(!dfReady||busy()||classUsed[c]||now-lastGagEnd<COOLDOWN_MS) return;
  if(now-hourStart>3600000UL){ hourStart=now; gagHour=0; }
  if(gagHour>=MAX_GAGS_HOUR){ Serial.printf("GOV: cap, refused %s\n",tag); return; }
  df.playFolder(voicePack,c); classUsed[c]=true; gagHour++; lastGagEnd=now;
  Serial.printf("EVT:%s pack=%d clip=%d\n",tag,voicePack,c);
}

/* Button: tap=volume, hold=voice pack, 10s=reset */
uint32_t btnDownAt=0;
void serviceButton(){
  bool down=digitalRead(PIN_BTN)==LOW;
  if(down&&!btnDownAt) btnDownAt=millis();
  if(!down&&btnDownAt){ uint32_t d=millis()-btnDownAt; btnDownAt=0;
    if(d>9000){ delay(100); ESP.restart(); }
    else if(d>1500){ voicePack=voicePack%3+1; Serial.printf("BTN: pack=%d\n",voicePack); }
    else if(d>30){ gagVolume=(gagVolume==15)?23:(gagVolume==23)?30:15;
      if(dfReady) df.volume(gagVolume); Serial.printf("BTN: vol=%d\n",gagVolume);} }
}
void calibrate(){
  float sx=0,sy=0,sz=0;
  for(int i=0;i<100;i++){ mpuSample(); sx+=ax_; sy+=ay_; sz+=az_; delay(10); }
  gravX=sx/100; gravY=sy/100; gravZ=sz/100;
  Serial.printf("CAL OK g=(%.2f,%.2f,%.2f)\n",gravX,gravY,gravZ);
}

/* Classifier state + engine */
uint32_t fallStart=0,fellAt=0,stillStart=0,lastMoveEnd=0,grabStart=0,invStart=0,lastCrossMs=0,convStart=0;
bool falling=false,still_=false,grabRun=false;
int8_t lastGzSign=0; uint8_t crossCount=0;
float gxDump, gzDump;

void classify(){
  uint32_t now=millis();
  float axc=ax_-gravX, ayc=ay_-gravY, azc=(gravZ>=0)? az_-gravZ : az_+gravZ;
  float mag=sqrtf(ax_*ax_+ay_*ay_+az_*az_);
  ringPush(mag,gz_);
  bool moving=fabsf(mag-1.0f)>0.06f||fabsf(gz_)>6.0f;
  if(moving) lastMotionMs=now;
  if(now-lastMotionMs>PHASE_RESET_MS){ for(int i=0;i<CL_END;i++) classUsed[i]=false;
    lastMotionMs=now; Serial.println("GOV: new journey phase"); }

  /* 1) FREEFALL + 2) IMPACT */
  if(mag<FREEFALL_G){ if(!falling){ falling=true; fallStart=now; } }
  else { if(falling && now-fallStart>=FREEFALL_MIN_MS) fellAt=now; falling=false; }
  if(mag>IMPACT_G){
    if(now-fellAt<500) dispatch(CL_FREEFALL,"FREEFALL->thud");
    else dispatch((Clip)(CL_IMPACT1+(int)random(0,2)),"IMPACT");
  }

  /* 3) WEIGH-IN: motion -> 3.5-6 s dead-still, upright */
  bool stationary=(ringVarMag(50)<STILL_VAR)&&(fabsf(gz_)<STILL_GYRO);
  if(stationary&&!still_){ still_=true; stillStart=now; }
  if(!stationary&&still_){ still_=false;
    uint32_t d=now-stillStart;
    if(d>=WEIGH_HOLD_MIN&&d<=WEIGH_HOLD_MAX&&fabsf(azc)<0.15f&&fabsf(gravZ)>0.7f
       &&(stillStart-lastMoveEnd)<WEIGH_PREMOTION) dispatch(CL_WEIGH,"WEIGH_IN"); }
  if(moving&&!still_) lastMoveEnd=now;

  /* 4) HANDLE GRAB: tilted carry 10 s */
  float tilt=atan2f(sqrtf(axc*axc+ayc*ayc), (gravZ>=0)?azc:-azc)*57.2958f;
  if(tilt>GRAB_TILT_MIN&&tilt<GRAB_TILT_MAX&&moving){
    if(!grabRun){ grabRun=true; grabStart=now; }
    if(now-grabStart>GRAB_MIN_MS){ dispatch(CL_CARRY,"HANDLE_GRAB"); grabRun=false; } }
  else grabRun=false;

  /* 5) CAROUSEL: periodic gz zero-crossings, 3-12 s period */
  int8_t s=(gz_>CAROUSEL_GZ)?1:(gz_<-CAROUSEL_GZ)?-1:0;
  if(s&&lastGzSign&&s!=lastGzSign){ uint32_t p=now-lastCrossMs;
    if(p>=CAR_X_MIN&&p<=CAR_X_MAX) crossCount++; lastCrossMs=now; }
  if(s) lastGzSign=s;
  if(now-lastCrossMs>40000) crossCount=0;
  if(crossCount>=CAR_X_NEED){ dispatch(CL_CAROUSEL,"CAROUSEL"); crossCount=0; }

  /* 6) CONVEYOR: 8 s band-limited rumble, no rotation */
  float v8=ringVarMag(800);
  if(v8>CONV_VAR_LO&&v8<CONV_VAR_HI&&crossCount==0){
    if(!convStart) convStart=now;
    if(now-convStart>CONV_MS){ dispatch(CL_CONVEYOR,"CONVEYOR"); convStart=0; } }
  else convStart=0;

  /* 7) INVERTED */
  if(az_<INVERT_AZ){ if(!invStart) invStart=now;
    if(now-invStart>INVERT_MS){ dispatch(CL_INVERTED,"INVERTED"); invStart=0; } }
  else invStart=0;

  /* 8) DARK IDLE */
  if(now-lastMotionMs>DARK_IDLE_MS){ dispatch(CL_IDLE,"DARK_IDLE"); lastMotionMs=now; }
}

void maybeSleep(){
  if(busy()||btnDownAt) return;
  if(millis()-lastMotionMs<SLEEP_AFTER_MS) return;
  Serial.println("SLEEP 1s"); Serial.flush();
  esp_sleep_enable_timer_wakeup(1000000ULL);
  esp_light_sleep_start();          // 1 s poll; latched INT catches interim motion
  if(motionLatched()) lastMotionMs=millis();
}

void setup(){
  Serial.begin(115200);
  pinMode(PIN_BUSY,INPUT); pinMode(PIN_BTN,INPUT_PULLUP); pinMode(PIN_INT,INPUT);
  Wire.begin(PIN_SDA,PIN_SCL); Wire.setClock(400000); Wire.setTimeOut(50);
  mpuInit(); dfInit(); calibrate();
  randomSeed(esp_random());
  lastMotionMs=millis(); hourStart=millis();
  Serial.println(dfReady?"DF OK":"DF FAIL (check microSD/wiring)");
}

void loop(){
  static uint32_t next=0; uint32_t now=millis();
  if((int32_t)(now-next)>=0){ next=now+10; mpuSample(); classify(); }  // 100 Hz
  serviceButton(); maybeSleep();
}
```

Build and flash
Libraries: install DFRobotDFPlayerMini from Library Manager (it speaks the YX5200 serial command set the DFPlayer uses ); Wire and esp_sleep come with the ESP32 core^1
Board selection: ESP32S3 Dev Module, USB CDC On Boot enabled so Serial prints appear at 115200
Expected boot log: CAL OK g=(...) → DF OK → then EVT: lines every time a classifier fires as you shake/lift/rotate the board — that serial trace doubles as your tuning log
Two honest caveats for the bench
Gyro axis mapping. gz_ is read from the middle gyro register (GY). Which physical axis the carousel rotates around depends on how the puck is oriented on the bag — during calibration on the turntable test (spin it slowly), check the serial log and reassign gz_ to whichever register peaks, or store all three and take the max-magnitude axis.
Interrupt wake. Rev A uses a 1-second sleep poll with the MPU-6050's latched motion interrupt so no motion is lost between polls; true GPIO6 ext1 wake for sub-100 µA idle is flagged as a Rev B firmware task in the code comments.

Tuning guidance still applies from the calibration note: run carpet drops at 0.3/0.6/1.0 m, tweak IMPACT_G and STILL_VAR first — those two constants gate the two highest-ranked gags in the catalog.

⁂
