// RoadGuard AI - NodeMCU ESP8266 buzzer (USB serial, no WiFi)
// Wiring (2N2222, flat side facing you: E B C):
//   D1 -> 330 ohm -> B (middle)
//   E (left)  -> GND
//   C (right) -> Buzzer -
//   Buzzer +  -> Vin
// The PC sends "B\n" over USB whenever a pothole is detected.

#define BUZZER 5          // GPIO5 = D1 on NodeMCU
#define ALARM_MS 5000     // total alarm length

void alarm() {
  unsigned long start = millis();
  while (millis() - start < ALARM_MS) {
    digitalWrite(BUZZER, HIGH);  // steady ON = loudest on an active buzzer
    delay(400);
    digitalWrite(BUZZER, LOW);   // short gap so it sounds like an alarm
    delay(100);
    yield();
  }
  digitalWrite(BUZZER, LOW);
  while (Serial.available()) Serial.read();  // drop beeps queued during the alarm
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);
  digitalWrite(BUZZER, HIGH);  // short test beep at start
  delay(300);
  digitalWrite(BUZZER, LOW);
}

void loop() {
  if (Serial.available() && Serial.read() == 'B') {
    alarm();
  }
}
