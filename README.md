# Competition Robot Control App (Expo + Bluetooth Classic)

A single-screen, low-latency controller app for HC-05 robots.

## Key Design

- Landscape-only control layout (no scrolling on control screen)
- Joystick-only drive input (no forward/backward/left/right buttons)
- Top bar controls: Bluetooth, Tuning, MANUAL/AUTO, triangle STOP
- Right side servo bars: two vertical + one horizontal
- Middle retro LCD panel with live telemetry
- Strict ASCII frame protocol ending in `;`
- Priority send order: STOP > MODE > MOTOR > SERVO > TUNING
- 50 ms send loop with change-only transmission

## Project Structure

- App.tsx
- src/screens/ControlScreen.tsx
- src/hooks/useRobotController.ts
- src/comms/bluetoothClassic.ts
- src/comms/priorityCommandEngine.ts
- src/control/driveMath.ts
- src/protocol/frames.ts
- src/protocol/frameStream.ts
- src/components/

## Protocol

The app sends exactly one command per frame:

- `STOP;`
- `MODE:MANUAL;` or `MODE:AUTO;`
- `M:L,R;` where `L` and `R` are integers in `-255..255`
- `S1:ANGLE;`, `S2:ANGLE;`, `S3:ANGLE;`
- `T:KEY=VALUE;`

The robot returns command acknowledgements:

- `ACK:ORIGINAL_FRAME`
- `NACK:ORIGINAL_FRAME`

Example:

- `ACK:M:120,120;`
- `NACK:T:MAX=999;`

All frames are uppercase normalized and ASCII-safe.

## Tuning Keys Implemented

- Drive: `MAX`, `ACC`, `DEAD`, `TURN`
- Servo limits: `S1MIN`, `S1MAX`, `S2MIN`, `S2MAX`, `S3MIN`, `S3MAX`
- Auto core: `OBSTACLETHRESHOLDCM`, `PIVOTBIASCM`, `BASEPWMFAST`, `BASEPWMMEDIUM`, `BASEPWMSLOW`, `MINPWM`
- Auto advanced: `STEERKPNUM`, `STEERKPDEN`, `STEERKDNUM`, `STEERKDDEN`, `FOLLOWTARGETCM`, `FOLLOWBASEPWM`, `FOLLOWKPNUM`, `FOLLOWKPDEN`

## Build and Run

Bluetooth Classic requires a native build (Expo Go is not enough).

1. Install dependencies:

```bash
npm install
```

2. Build and run on Android:

```bash
npm run android
```

3. Start Metro for dev client:

```bash
npm run start
```

4. Run critical protocol/control tests:

```bash
npm run test
```

5. Type-check the app:

```bash
npm run typecheck
```

## APK Build (EAS)

1. Login:

```bash
eas login
```

2. Build cloud APK profile:

```bash
eas build -p android --profile apk
```

3. Build local APK profile:

```bash
eas build -p android --profile apk-local --local
```

## Control Flow Summary

- Joystick movement is converted to differential drive:
  - `left = y + x`
  - `right = y - x`
- Dead zone, response shaping, turn scale, max speed, and acceleration smoothing are applied.
- Motor values are sent only when changed.
- STOP is latched and overrides lower-priority commands until mode command clears it.

## Firmware Pairing

Use the updated `CompetitionRobot.ino` in workspace root.

Telemetry from robot is expected as:

- `R:MODE,STATE,FRONT,LEFT,RIGHT,ML,MR,S1,S2,S3,STOP;`

Where `MODE` is `A` or `M`.
