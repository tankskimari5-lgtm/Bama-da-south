# TRUE LIFE — Eastbrook, Chapter 01

An original third-person browser life simulator. All 3D characters, vehicles, buildings, signs, and surface textures are generated locally in JavaScript. No external game assets or asset CDN is used. Three.js is bundled with the app.

## Character Studio revision 2

Visit `/character.html` for front/side/back views, a face close-up, geometry-based appearance controls, twelve animation studies, expressions, hairstyle/facial-hair choices, and appearance import/export. Use in TRUE LIFE preserves your existing game progression. The character now has a 52-bone rig, procedural skin/eye/fabric shaders, anatomical surface generators, a connected implicit-surface T-shirt, and speed-dependent leg IK. No game assets are downloaded. See [CHARACTER_SYSTEM.md](CHARACTER_SYSTEM.md) for architecture, test commands, and current visual limits.

## Run

```sh
cd true-life
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Requires Node 20.19+ or Node 22.12+ (Vite requirement). The game needs a WebGL 2 browser. Local saves stay on the same device and origin. Private browsing or clearing site data can remove saves; use Pause → Export save for a backup.

## Playable now

- A custom humanoid with an actual Three.js bone hierarchy, weighted skin meshes, facial features, hands, shoes, hair, clothing, and blended procedural walking/running/jumping/crouching/sitting animation. Appearance choices include presentation, face, build, skin, hair, and outfit.
- Camera-relative movement, gravity, jump, building/furniture collision, a third-person camera with wall obstruction checks, desktop mouse dragging, and touch camera dragging.
- One 224 m neighborhood with homes, an apartment complex, a café, clothing store, bank, and dealership, plus sidewalk pedestrians, road traffic, crosswalks, traffic signals, road markings, trees, power lines, and a background skyline.
- One detailed original sedan with shaped body panels, glass, lights, mirrors, interior seats, dashboard, wheels, steering pivots, engine detail, door motion, hood, trunk, fuel, condition, braking, reverse, and static collision. Nearby low-detail traffic uses the same original generator.
- Five separate enterable furnished interiors. Walk up to a door and interact. Inside, approach the object to act; find the EXIT door to return.
- An apartment with sleep, sitting, cooking, and weekly rent. The first week is included; later weeks cost $120.
- A café job with a real sequence: talk to Maya at the center counter, collect the order at the right end, serve the right-hand table, return dishes at the left end. Each completed shift earns $30. Orders cannot pay twice without completing another sequence.
- Food purchases, $50 bank deposits/withdrawals, paid clothing that remains owned, refueling/repair services, a paid exchange for the sage sedan, and neighbor greetings that retain familiarity.
- Hunger, energy, health, day/night lighting, night streetlights, an optional synthesized horn and footsteps, destination markers, a minimap, pause/settings, manual/autosave, and validated JSON save import/export.
- Adaptive resolution and graphics presets. Static environment and rigid moving parts are batched by material. Distant pedestrians and traffic are culled. No background server or account is required.

This is the first playable foundation, not a finished GTA-scale simulation. The procedural art is stylized and needs further anatomy, material, architecture, and vehicle refinement to approach realism.

## Controls

Desktop: WASD / arrow keys move or drive; drag the viewport to look; Shift runs; Space jumps or applies the handbrake; C crouches; E or F interacts / enters / exits; L toggles headlights; H sounds the horn; Q toggles turn indicators; M opens destinations; Esc pauses.

Mobile: left walking joystick, viewport drag to look, RUN / jump / LOW buttons, and a contextual interaction button. Driving hides the walking joystick and shows dedicated left/right steering arrows, GAS, and BRAKE (hold after stopping to reverse). Stop before exiting. Select low graphics on slower phones.

## Architecture

- `src/character.js` and `src/human/`: original anatomy, shaders, facial morphs, hair, garments, full hand/foot skeleton and procedural pose animation.
- `src/vehicle.js`: original panel, body loft, interior, wheel, light, and animated pivot generators.
- `src/geometry.js`: original surface, material, canvas texture, sign, world UV, and mesh batching utilities.
- `src/world.js`: neighborhood, collisions, pedestrians, traffic signals, locations, and interiors.
- `src/input.js`: pointer capture, touch joystick, camera, steering/pedals, keyboard, and focus cleanup.
- `src/state.js`: save schema, validation, transactions, time, needs, collision, and driving simulation.
- `src/main.js`: rendering, progression, UI, interactions, camera, persistence, and integration.
- `tests/state.test.js`: meaningful simulation and data-integrity checks.
- `tests/browser.mjs`: desktop/mobile browser gameplay checks against the dev server. Run `npm run test:browser` while `npm run dev` runs at port 5173. Uses `/usr/bin/chromium` by default; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for another local Chromium installation. Development-only inspection hooks are excluded from production builds.

## Preserved original game

`public/classic.html` preserves the previous TRUE LIFE game verbatim, with its separate existing local save slots. The new 3D game uses `true-life-open-world-v1`. It does not overwrite or migrate Classic saves. Both are served at the same existing project.

Only files under `true-life/` belong to this change. The repository's root package, build script, compressed source, and separate Bama Da South game are unchanged.

## Deployment

Existing Vercel project: `true-life-simulator`, team `glitch-gaming`. Root directory `true-life`, framework `vite`, install `npm ci`, build `npm run build`, output `dist`. This is independent from the Bama Da South deployment.

## Still to build

- More detailed realistic art and smoother vehicle ingress/egress, cloth, and limb transitions.
- Proper drivetrain, tires, contact/spring suspension physics, more vehicle chassis types, collision response with other vehicles, and persistent collections of multiple drivable cars. Current suspension is visual body roll/wheel travel over a flat road, not a tire-contact physics solver.
- A larger streamed multi-neighborhood city, additional enterable houses, parking/traffic route planning, real daily NPC work/home schedules, and richer conversation. Current walkers follow sidewalk routes; traffic uses a limited loop and a timed signal.
- Weather and storms, ambient environmental soundscapes, spatial vehicle audio, traffic laws, and police.
- Full career advancement, housing purchases/furnishing, education, romance/families, businesses/investments, insurance/registration, loans/taxes, stress/hygiene, and cloud/multiplayer architecture.

Those features are not advertised as working controls in this build.
