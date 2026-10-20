# TRUE LIFE procedural human, revision 2

Open `/character.html` for the dedicated Character Studio. Browser captures of the final build are available at `/character-review/` (front, side, back, and face close-up). These screenshots are review artifacts and are not textures or imported assets used by the character. The game also links to it from the welcome and pause panels. It is an interactive preview and is integrated with the actual game; it does not replace gameplay.

All visible character surfaces are original BufferGeometry generated in this repository. No character/animation/model/texture files, avatar APIs, fonts, or asset CDNs are requested. Three.js and its camera/environment utilities are bundled development dependencies.

## Geometry

`src/human/anatomy.js` builds continuous parametric lofts with anatomical cross sections and sculpted surface offsets. The head has shaped cranial, temporal, cheek, brow, nose, muzzle, chin, and jaw regions. Facial parts include curved scleral surfaces, iris fibers, pupils, corneal highlights, upper/lower eyelid surfaces, individual brow strands, ear helix/antihelix/concha/tragus, nostrils, philtrum, lips, and mouth cavity.

The body includes neck/shoulder/chest/waist/pelvis sections, biceps/forearm/elbow/wrist profiles, calves/knees/ankles, palms, individual fingers/thumbs and nails, and contoured feet. Body sections intersect beneath garments, rather than being a single watertight retopologized production mesh. This should be refined before using the model for offline cinematics, close-up skin exposure, or high-end deformation.

`src/human/implicit.js` extracts one connected shirt surface from a smooth density field using original marching-tetrahedra code, then welds duplicate vertices. `src/human/clothing.js` builds a fitted T-shirt, sleeve/neck/hem geometry, trouser shapes, pocket surfaces, seams, sneakers, soles, and crossed laces. Clothing uses the same skeleton and blends weights through the joints. Covered body geometry is retained for anatomy inspection but hidden under garments during gameplay to prevent skin intersections. Extreme slider combinations and very deep poses may still show intersections; there is no cloth solver.

`src/human/hair.js` generates short curls, buzz, waves, afro, braids, twists, locs, longer hair, and shaved variants, plus stubble/beard/mustache options. Braids and twists contain multiple wound strands. Hair remains geometric and stylized; there is no physically simulated strand motion.

## Materials

`src/human/materials.js` adds procedural skin mottling, cheek/joint tinting, roughness and specular response, high-detail pore perturbation, and a small subsurface-like rim contribution. The latter is an approximation, not volumetric subsurface scattering. Iris fibers and fabric weave are mathematical shader patterns; no textures are imported.

## Rig and motion

`src/human/rig.js` provides 52 named bones: pelvis, spine, chest, neck, head, jaw, shoulders, arms, elbows, wrists, three segments for each finger/thumb, legs, knees, ankles, and toes. Vertex weights are normalized with smooth influence transitions. The face uses procedural morph targets and animated jaw/eye/lid behavior.

`src/human/animation.js` implements idle breathing, walk/run/sprint, turning, jump/landing, crouch, sit, entry/exit studies, looking, and conversational gestures. Walking uses sagittal two-bone IK and a speed-dependent stance/swing trajectory with heel/toe roll. It is grounded on the game's flat walking surfaces; it is not a general terrain-contact solver. The existing player controller continues to handle world translation, gravity, collisions, and camera-relative WASD/touch movement. Entry/exit blends remain a simplified procedural study and need further refinement for precise hand contact with each vehicle.

## Appearance and saves

`src/human/config.js` normalizes and bounds height, build, shoulder width, waist, muscle, skin, face, jaw width, nose width/projection, eye shape, hair/color, facial hair, and clothing colors. Every dimensional setting affects actual vertices, scale, or both.

The studio saves its profile at `true-life-character-v2`. “Use in TRUE LIFE” updates only the appearance portion of an existing game save. It preserves money, job, position, and progression. If there is no game save, the new game reads the studio profile. Appearance JSON import/export is separate from full-game save import/export. Old revision-1 game saves remain supported and receive defaults for the new appearance fields.

## Studio controls

- Front, side, back, face close-up, auto-rotation and mouse/touch orbit.
- Form/face/style tabs with geometry sliders and color/style selectors.
- Twelve animation preview buttons, playback speed/pause, expressions and anatomy/outfit toggle.
- Local appearance persistence, JSON import/export and a direct return to gameplay.
- Separate scrollable mobile control panel with touch orbit in the preview.

## Performance

The face preview, normal gameplay, and distant inhabitants use distinct detail levels. The high-detail material adds pore shading; lower levels omit it. Garments and skin sections share materials, and compatible geometry is batched. The default dressed model uses 20 character draw calls at each level; the anatomy preview can add one. The game’s low graphics preset selects the low character level. Mobile studio lighting uses a smaller shadow map and omits pore shading. The city uses a single lower-detail model per NPC; the player has switchable medium/low LODs. Metrics in the studio report the active level. Phone performance still needs measurement on physical target devices; automated browser tests emulate touch and viewport behavior, not mobile hardware throughput.

## Validation

Run `npm test` for geometry validity, actual geometry customization, normalized skin weights, bone layout, knee direction, analytical foot placement, all hair generators, and the existing state/collision/finance checks. Run `node tests/studio.mjs` with the development server at port 5173 for rendered view/appearance/animation/mobile/game-transfer checks. Set `CHARACTER_SCREENSHOTS` to select the screenshot directory; the default is `/tmp/true-life-character`. The existing `npm run test:browser` checks walking, jumping, interiors, employment, money, driving, and persistence with the new character.

## Visual limits

This is an original procedural character study with considerably more structure than revision 1. It is not a scanned or hand-sculpted photorealistic human. The face, ears, hairline, garment topology, and deformation still need artistic refinement. It has no commercial likeness target, imported animations, dynamic cloth/hair physics, full-body terrain IK, or cinematic facial performance capture.
