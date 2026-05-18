<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&height=220&text=Competition%20Robot%20Control&fontAlignY=38&fontSize=50&desc=Expo%20Bluetooth%20Classic%20Controller%20with%20Retro%20UI&descAlignY=60&color=0:1a1d1f,35:26351e,65:4ec8e6,100:ff4858&fontColor=ffffff" alt="Competition Robot Control banner" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-Managed-111111?logo=expo&logoColor=white" alt="Expo" />
  <img src="https://img.shields.io/badge/React%20Native-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Bluetooth%20Classic-HC--05-0A7E8C" alt="Bluetooth Classic" />
  <img src="https://img.shields.io/badge/Scheduler-20ms-2E7D32" alt="20ms" />
  <img src="https://img.shields.io/badge/Protocol-ASCII%20Frames-8F2331" alt="ASCII Frames" />
  <img src="https://img.shields.io/badge/Web-Simulated%20Device-4EC8E6" alt="Web Sim" />
</p>

## Competition Robot Control

A single-screen, low-latency controller for HC-05 robots built with Expo, React Native, and Bluetooth Classic.

This UI is designed for fast, confident operation:

- Landscape-only control surface with no scrolling
- Joystick-only drive input
- Top bar for Bluetooth, Tuning, MANUAL/AUTO, and STOP
- Retro LCD telemetry panel with strong contrast
- Strict ASCII frame protocol with priority scheduling

## Visual Effects

The UI uses deliberate motion to feel tactile and readable:

- Entrance motion: panels rise in with staggered timing
- LCD refresh: scanline wipe on telemetry updates
- Bluetooth connect: soft breathing glow on status LED
- STOP pulse: short double pulse, then solid hold
- Control feedback: press scale to 0.98 for 120 ms

## Color Schema

Primary palette from `src/theme/palette.ts`:

<p>
  <img src="https://img.shields.io/badge/Shell-1A1D1F-1A1D1F" alt="Shell" />
  <img src="https://img.shields.io/badge/Panel-2A2F35-2A2F35" alt="Panel" />
  <img src="https://img.shields.io/badge/LCD_BG-91AB6F-91AB6F" alt="LCD BG" />
  <img src="https://img.shields.io/badge/LCD_Glow-B9D087-B9D087" alt="LCD Glow" />
  <img src="https://img.shields.io/badge/Accent-4EC8E6-4EC8E6" alt="Accent" />
  <img src="https://img.shields.io/badge/Warning-FF4858-FF4858" alt="Warning" />
</p>

## Architecture

```mermaid
flowchart LR
  UI[ControlScreen + components]
  Hooks[useRobotController]
  Control[driveMath + tuning catalog]
  Scheduler[priorityCommandEngine]
  Protocol[frames + frameStream]
  Comms[bluetoothClassic]
  Robot[HC-05 robot firmware]

  UI --> Hooks --> Control --> Scheduler --> Protocol --> Comms --> Robot
  Robot --> Protocol --> Hooks
```

## Photos

Create a folder named `Photos` and add your screenshots using the placeholders below.

<table>
  <tr>
    <td><img src="Photos/photo-01.jpg" alt="Photo 01" width="420" /></td>
    <td><img src="Photos/photo-02.jpg" alt="Photo 02" width="420" /></td>
  </tr>
  <tr>
    <td><img src="Photos/photo-03.jpg" alt="Photo 03" width="420" /></td>
    <td><img src="Photos/photo-04.jpg" alt="Photo 04" width="420" /></td>
  </tr>
  <tr>
    <td><img src="Photos/photo-05.jpg" alt="Photo 05" width="420" /></td>
    <td><img src="Photos/photo-06.jpg" alt="Photo 06" width="420" /></td>
  </tr>
  <tr>
    <td><img src="Photos/photo-07.jpg" alt="Photo 07" width="420" /></td>
    <td><img src="Photos/photo-08.jpg" alt="Photo 08" width="420" /></td>
  </tr>
  <tr>
    <td><img src="Photos/photo-09.jpg" alt="Photo 08" width="420" /></td>
  </tr>
</table>

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

## Tuning Keys

- Servo limits: `S1MIN`, `S1MAX`, `S2MIN`, `S2MAX`, `S3MIN`, `S3MAX`
- Core tuning: `KP`, `KD`, `SP`, `MS`, `TH`, `TS`, `NR`, `MD`, `PB`, `PV`
- Advanced tuning: `RA`, `RV`, `DZ`, `BR`, `CM`, `AV`, `PT`, `DP`, `DE`, `ST`, `BL`

## Project Structure

```text
.
|- App.tsx
|- src/
|  |- screens/ControlScreen.tsx
|  |- hooks/useRobotController.ts
|  |- comms/bluetoothClassic.ts
|  |- comms/priorityCommandEngine.ts
|  |- control/driveMath.ts
|  |- protocol/frames.ts
|  |- protocol/frameStream.ts
|  |- components/
```

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

## Web Mode

The project can run as a website.

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
- The web build includes a safe simulated Bluetooth device (HC-05 Web Demo).
- For real HC-05 hardware control, use the Android app build.

## Deploy

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

## Firmware Pairing

Use the updated `CompetitionRobot.ino` in workspace root.

Telemetry from robot is expected as:

- `T=front,left,right,mode,currentL,currentR;`

Where `mode` is `A` or `M`.
