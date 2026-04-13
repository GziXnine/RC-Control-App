# Design Direction

The control surface intentionally uses a retro 1990s hardware-panel look:

- Dark shell body with raised frame edges
- Knob-like slider thumbs sized for thick-finger use
- Pixel/LCD center display with monochrome green palette
- Strong contrast top command bar for muscle-memory operation

## Layout Contract

- No scrolling on primary control screen
- Fixed landscape interaction model
- Three horizontal zones:
  - Left: joystick (about one third of width)
  - Middle: telemetry LCD
  - Right: fast servo bars (2 vertical, 1 horizontal)

## Interaction Priorities

- Emergency STOP is always visible
- Mode change available from top bar only
- Bluetooth connect and tuning are secondary actions in modals
- Joystick and servo gestures stay responsive under frequent updates
