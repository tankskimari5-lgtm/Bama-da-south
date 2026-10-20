import * as T from "three";
export function createAnimator(rig, face, scale = 1) {
  let time = 0,
    phase = 0,
    blend = 0,
    previousAir = false,
    landing = 0,
    heading = 0;
  const { joints: j, rest } = rig,
    states = { crouch: 0, sit: 0, air: 0, enter: 0, talk: 0 };
  const expression = { smile: 0, frown: 0, talk: 0 };
  function animate(dt, speed = 0, options = {}) {
    dt = Math.min(0.08, Math.max(0, dt));
    time += dt;
    const mode = options.mode,
      run = options.run || mode === "run" || mode === "sprint",
      crouch = options.crouch || mode === "crouch",
      sit = options.sit || mode === "sit",
      air = options.air || mode === "jump";
    speed =
      mode === "walk"
        ? 1.4
        : mode === "run"
          ? 3
          : mode === "sprint"
            ? 4.8
            : mode === "turn"
              ? 1
              : speed;
    const vehicleCycle = (time % 4) / 4,
      entering = mode === "enter" || mode === "exit",
      entryT = mode === "exit" ? 1 - vehicleCycle : vehicleCycle;
    const move = Math.min(1, speed / 1.3),
      rate = run ? (mode === "sprint" ? 3 : 2.6) : 1.85;
    const cycleRate = rate * Math.min(1.35, speed / (run ? 3.2 : 1.45));
    phase += dt * Math.PI * 2 * cycleRate;
    blend = T.MathUtils.damp(blend, move, 9, dt);
    for (const [k, value] of Object.entries({
      crouch: crouch ? 1 : 0,
      sit: entering ? T.MathUtils.smoothstep(entryT, 0.2, 0.86) : sit ? 1 : 0,
      air: air ? 1 : 0,
      enter:
        options.enter ||
        (["enter", "exit"].includes(mode)
          ? 0.5 + 0.5 * Math.sin(time * 1.5)
          : 0),
      talk: mode === "talk" ? 1 : options.talk || 0,
    }))
      states[k] = T.MathUtils.damp(states[k], value, 7, dt);
    if (previousAir && !air) landing = 1;
    previousAir = !!air;
    landing = T.MathUtils.damp(landing, 0, 9, dt);
    for (const [name, bone] of Object.entries(j)) {
      bone.position.copy(rest[name].position);
      bone.rotation.set(0, 0, 0);
    }
    const walk = Math.sin(phase),
      runBlend = run ? 1 : 0,
      stride = (0.42 + 0.28 * runBlend) * blend,
      sw = states.sit,
      cr = states.crouch,
      ar = states.air;
    j.hips.position.y =
      0.97 -
      0.4 * sw -
      0.22 * cr -
      (0.045 + 0.025 * runBlend) * blend +
      Math.cos(phase * 2) * (0.012 + 0.014 * runBlend) * blend -
      0.035 * landing +
      Math.sin(time * 1.7) * 0.001;
    j.hips.rotation.y = walk * 0.035 * blend;
    j.hips.rotation.z = Math.cos(phase) * 0.02 * blend;
    j.spine.rotation.x =
      (entering ? Math.sin(vehicleCycle * Math.PI) * 0.23 : 0) +
      0.045 * blend +
      0.13 * runBlend * blend +
      0.27 * cr -
      0.02 * sw +
      0.13 * landing;
    j.chest.rotation.y =
      -walk * 0.065 * blend +
      (entering ? Math.sin(vehicleCycle * Math.PI) * 0.25 : 0);
    j.chest.scale.set(
      1,
      1 + Math.sin(time * 1.7) * 0.002,
      1 + Math.sin(time * 1.7) * 0.004,
    );
    j.neck.rotation.x = -0.035 * cr;
    j.head.rotation.y =
      options.lookYaw ??
      (mode === "look"
        ? Math.sin(time * 0.7) * 0.5
        : Math.sin(time * 0.33) * 0.035);
    j.head.rotation.x =
      mode === "look"
        ? Math.sin(time * 0.5) * 0.1
        : Math.sin(time * 0.7) * 0.01;
    for (const side of [-1, 1]) {
      const s = side < 0 ? "left" : "right",
        w = walk * side,
        leg = j[s + "Leg"],
        knee = j[s + "Knee"],
        ankle = j[s + "Ankle"],
        toe = j[s + "Toe"],
        arm = j[s + "Arm"];
      const cycle =
          (((phase / (Math.PI * 2) + (side < 0 ? 0 : 0.5)) % 1) + 1) % 1,
        stance = run ? 0.48 : 0.62,
        step = cycleRate > 0.01 ? (speed / cycleRate) * stance : 0;
      const travel =
          cycle < stance ? cycle / stance : (cycle - stance) / (1 - stance),
        footZ =
          (cycle < stance ? -0.5 + travel : 0.5 - travel) *
          Math.min(0.67, step),
        lift =
          cycle < stance
            ? 0
            : Math.sin(travel * Math.PI) * (run ? 0.17 : 0.085);
      const ik = solveLegIK(0.105 + lift - (j.hips.position.y - 0.04), footZ);
      const weight = Math.max(blend, cr);
      leg.rotation.x =
        ik.hip * weight * (1 - sw) * (1 - ar) + 1.38 * sw + 0.35 * ar;
      knee.rotation.x =
        ik.knee * weight * (1 - sw) * (1 - ar) - 1.43 * sw - 0.72 * ar;
      ankle.rotation.x =
        ik.ankle * weight * (1 - sw) * (1 - ar) +
        (cycle < stance
          ? -0.09 * Math.sin(travel * Math.PI)
          : 0.12 * Math.sin(travel * Math.PI)) *
          blend;
      toe.rotation.x =
        Math.max(0, travel - 0.72) * 0.2 * blend * (cycle < stance ? 1 : 0);
      arm.rotation.x = -stride * w * 0.82 * (1 - sw) - 0.67 * sw - 0.25 * ar;
      arm.rotation.z = side * (0.075 + 0.35 * states.enter);
      j[s + "Elbow"].rotation.x =
        -0.1 -
        0.55 * runBlend * blend -
        0.12 * sw -
        Math.max(0, w) * 0.2 * blend;
      j[s + "Shoulder"].rotation.z = side * 0.018 * Math.sin(time * 0.8);
      j[s + "Wrist"].rotation.x = -0.03;
      if (states.talk > 0.01) {
        arm.rotation.x -=
          states.talk * (0.25 + 0.13 * Math.sin(time * 2 + side));
        j[s + "Elbow"].rotation.x -=
          states.talk * (0.6 + 0.25 * Math.sin(time * 2.3 + side));
        j[s + "Wrist"].rotation.z = Math.sin(time * 1.7) * 0.1 * states.talk;
      }
      for (let f = 0; f < 5; f++) {
        const relax = f === 4 ? 0.1 : 0.16;
        j[s + "Finger" + f].rotation.x =
          relax +
          0.18 * runBlend * blend -
          0.06 * states.talk * Math.sin(time * 3 + f);
        j[s + "Finger" + f + "Mid"].rotation.x = 0.15 + 0.2 * runBlend * blend;
        j[s + "Finger" + f + "Tip"].rotation.x = 0.1 + 0.1 * runBlend * blend;
      }
    }
    const blinkPhase = time % 4.7,
      blink = blinkPhase < 0.16 ? Math.sin((blinkPhase / 0.16) * Math.PI) : 0;
    for (const [name, target] of Object.entries({
      smile: options.expression === "smile" ? 1 : 0,
      frown: options.expression === "frown" ? 1 : 0,
      talk: states.talk * (0.3 + 0.7 * Math.max(0, Math.sin(time * 12))),
    }))
      expression[name] = T.MathUtils.damp(expression[name], target, 12, dt);
    j.jaw.rotation.x = expression.talk * 0.07;
    face.update({
      blink,
      expression,
      gazeX: Math.sin(time * 0.38) * 0.045,
      gazeY: Math.sin(time * 0.61) * 0.025,
    });
  }
  return {
    animate,
    get time() {
      return time;
    },
    reset() {
      time = phase = blend = landing = 0;
    },
  };
}

// Sagittal two-bone IK. Positive hip rotation brings the thigh toward local -Z;
// a negative knee angle flexes the lower leg behind it. No imported motion data.
export function solveLegIK(y, z, upper = 0.42, lower = 0.405) {
  const distance = Math.min(
    upper + lower - 0.0001,
    Math.max(0.08, Math.hypot(y, z)),
  );
  const knee = -Math.acos(
    T.MathUtils.clamp(
      (distance * distance - upper * upper - lower * lower) /
        (2 * upper * lower),
      -1,
      1,
    ),
  );
  const hip =
    Math.atan2(-z, -y) +
    Math.acos(
      T.MathUtils.clamp(
        (upper * upper + distance * distance - lower * lower) /
          (2 * upper * distance),
        -1,
        1,
      ),
    );
  return { hip, knee, ankle: -hip - knee };
}
