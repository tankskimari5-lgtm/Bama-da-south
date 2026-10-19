# Bama Da South V3.4 — Box Chevy + Audio Shop (TEST)

Test URL: https://bama-da-south-speaker-test.vercel.app
Production URL (unmodified): https://bama-da-south.vercel.app

## Changes on audio-dev
- Single drivable Bama Box Chevy-style sedan. Previous five-car catalog cannot be purchased or selected.
- Ambient AI car traffic disabled. Existing pedestrians, missions, map, interiors, jobs and money systems retained.
- Box-body car has an articulated hood, articulated trunk, visible V8 engine bay, trunk carpet and a visual engine fan.
- Nearby on-foot mobile buttons OPEN HOOD / OPEN TRUNK; driving automatically closes their targets.
- Default saved car has no speaker installation. Music-reactive trunk audio appears only when paid for.
- Southline Auto garage now sells installed Dual 12-inch ($950), Quad ($2,750), Premium ($5,200) packages, charging the existing game cash balance.
- Install choice is saved to `bama-da-south-v2-save` as `audioKit`; old saves migrate to car model index 0 and no stereo.
- Paid music player supports local audio file or synthesized beat with FFT-driven cone animation.

## Test results
- Full source restores from GitHub to an unchanged V3.3 base via build.mjs SHA-256 integrity check.
- NPM build and JS syntax: PASS.
- Test Vercel deployment: READY, HTTP 200, latest Git branch audio-dev.
- Mobile Chromium: no page errors; introductory screen loads and game enters.
- Walk near car: OPEN HOOD / OPEN TRUNK appear and toggle labels correctly.
- At Southline Auto: garage shows install option and three speaker tiers.
- Purchase with $7,000: $950 dual kit charges cash to $6,050 and records audioKit='dual'.
- Reload persistence with $1,000: paid dual kit remains after reload with cash $50.
- Insufficient funds $500: dual kit purchase rejected with $450 shortage, audioKit stays null.

## Known limitation
This integrated build **rebuilds a stylized gray box-body sedan with native Three.js geometry**, and its hood/trunk/audio are functional. It does NOT yet embed the previously generated more detailed `Bama_Box_Sedan_Mobile_Optimized.glb` binary. The standalone .glb remains available in the ChatGPT-generated Box Chevy 3D kit; to use that exact mesh, publish it to `public/cars/` and wire in GLTFLoader and paid visibility of its built-in speakers. Avoid falsely claiming the exact GLB is installed until verified.

## Safety
The game at bama-da-south.vercel.app is untouched; do not promote before player review and successful replacement of the exact binary model when desired.
