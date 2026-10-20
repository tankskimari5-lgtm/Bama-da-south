export function createInput(canvas, actions) {
  const keys = new Set(),
    drive = { left: false, right: false, gas: false, brake: false },
    stick = { x: 0, y: 0 };
  let look = null,
    joyPointer = null,
    sprint = false;
  const input = {
    keys,
    drive,
    stick,
    yaw: 0,
    pitch: 0.2,
    jump: false,
    sprint: false,
    crouch: false,
    clear() {
      keys.clear();
      Object.keys(drive).forEach((k) => (drive[k] = false));
      stick.x = stick.y = 0;
      sprint = false;
      input.sprint = false;
      input.jump = false;
      look = null;
      joyPointer = null;
      document.getElementById("stick").style.transform = "";
    },
  };
  const typing = () =>
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
  window.addEventListener("keydown", (e) => {
    if (typing()) return;
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k))
      e.preventDefault();
    keys.add(k);
    if (!e.repeat) {
      if (k === "e" || k === "f") actions.interact();
      if (k === "escape") actions.pause();
      if (k === "m") actions.map();
      if (k === " ") input.jump = true;
      if (k === "c") input.crouch = !input.crouch;
      if (k === "l") actions.lights();
      if (k === "h") actions.horn();
      if (k === "q") actions.signal();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => {
    input.clear();
    actions.blur();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      input.clear();
      actions.blur();
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (look?.id !== e.pointerId) return;
    input.yaw -= (e.clientX - look.x) * 0.004;
    input.pitch = Math.max(
      -0.25,
      Math.min(0.8, input.pitch + (e.clientY - look.y) * 0.003),
    );
    look.x = e.clientX;
    look.y = e.clientY;
  });
  const endLook = (e) => {
    if (look?.id === e.pointerId) look = null;
  };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);
  const joystick = document.getElementById("joystick"),
    thumb = document.getElementById("stick");
  function move(e) {
    if (joyPointer !== e.pointerId) return;
    const b = joystick.getBoundingClientRect(),
      x = e.clientX - (b.left + b.width / 2),
      y = e.clientY - (b.top + b.height / 2),
      r = b.width * 0.32,
      len = Math.max(r, Math.hypot(x, y));
    stick.x = x / len;
    stick.y = y / len;
    thumb.style.transform = `translate(${stick.x * r}px,${stick.y * r}px)`;
  }
  joystick.addEventListener("pointerdown", (e) => {
    joyPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    move(e);
  });
  joystick.addEventListener("pointermove", move);
  const endJoy = (e) => {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    stick.x = stick.y = 0;
    thumb.style.transform = "";
  };
  joystick.addEventListener("pointerup", endJoy);
  joystick.addEventListener("pointercancel", endJoy);
  joystick.addEventListener("lostpointercapture", endJoy);
  function hold(el, set) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      set(true);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      el.addEventListener(name, () => set(false));
  }
  document
    .querySelectorAll("[data-drive]")
    .forEach((el) => hold(el, (v) => (drive[el.dataset.drive] = v)));
  hold(document.getElementById("sprint"), (v) => (sprint = v));
  document.getElementById("jump").onclick = () => (input.jump = true);
  document.getElementById("crouch").onclick = () =>
    (input.crouch = !input.crouch);
  input.movement = () => {
    let x =
        stick.x +
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft")),
      z =
        stick.y +
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    input.sprint = sprint || keys.has("shift");
    return { x, z, length: Math.min(1, length) };
  };
  input.vehicle = () => ({
    left: drive.left || keys.has("a") || keys.has("arrowleft"),
    right: drive.right || keys.has("d") || keys.has("arrowright"),
    gas: drive.gas || keys.has("w") || keys.has("arrowup"),
    brake: drive.brake || keys.has("s") || keys.has("arrowdown"),
    handbrake: keys.has(" "),
  });
  return input;
}
