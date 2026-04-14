# Competition Robot Control App (Expo + Bluetooth Classic)

A single-screen, low-latency controller app for HC-05 robots.

## Key Design

- Landscape-only control layout (no scrolling on control screen)
- Joystick-only drive input (no forward/backward/left/right buttons)
- Top bar controls: Bluetooth, Tuning, MANUAL/AUTO, triangle STOP
- Right side servo bars: three vertical
- Middle retro LCD panel with live telemetry
- Strict ASCII frame protocol ending in `;`
- Priority send order: STOP > MODE > MOTOR > SERVO > TUNING
- 20 ms scheduler with change-only transmission and per-class rate guards

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
- `A=0;` or `A=1;`
- `M=L,R;` where `L` and `R` are integers in `-255..255`
- `S1=ANGLE;`, `S2=ANGLE;`, `S3=ANGLE;`
- `KEY=VALUE;` tuning frames (for example `TH=20;`)

The robot telemetry stream is parsed from:

- `T=front,left,right,mode,currentL,currentR;`

All frames are uppercase normalized and ASCII-safe.

## Tuning Keys Implemented

- Servo limits: `S1MIN`, `S1MAX`, `S2MIN`, `S2MAX`, `S3MIN`, `S3MAX`
- Core tuning: `KP`, `KD`, `SP`, `MS`, `TH`, `TS`, `NR`, `MD`, `PB`, `PV`
- Advanced tuning: `RA`, `RV`, `DZ`, `BR`, `CM`, `AV`, `PT`, `DP`, `DE`, `ST`, `BL`

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

## Web Mode (Browser)

The project can run as a website now.

- Start web dev server:

```bash
npm run web
```

- Build static web output:

```bash
npm run build:web
```

- Preview production export locally:

```bash
npm run preview:web
```

Notes:

- Browser runtime cannot use Android Bluetooth Classic (HC-05) directly.
- The web build includes a safe simulated Bluetooth device (`HC-05 Web Demo`) so the full UI and telemetry flow can be demonstrated live online.
- For real HC-05 hardware control, use the Android app build.

## Deploy Live Website

You can deploy the generated web app directly:

1. Vercel:
  - Import this `mobile-app` folder.
  - `vercel.json` is included and configured for SPA routing and `dist` output.

2. Netlify:
  - Import this `mobile-app` folder.
  - `netlify.toml` is included and configured for build command and SPA redirect.

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

- `T=front,left,right,mode,currentL,currentR;`

Where `mode` is `A` or `M`.
