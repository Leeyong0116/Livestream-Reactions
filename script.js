// Livestream Reaction Engine
//
// Flow:
// 1. A button click calls spawnReactions().
// 2. spawnReactions() creates the reaction elements and adds them to the stage.
// 3. The selected engine animates them:
//    - CSS mode:  the "reaction--css" class runs the @keyframes in style.css,
//                 which animate layout properties (bottom, margin-left, font-size).
//    - GSAP mode: startGsapFlight() builds a timeline that animates
//                 transform and opacity only (x, y, scale, opacity).
// 4. When a flight ends, the element removes itself from the DOM.

(() => {
  // ---- Page elements ----
  const container = document.getElementById("reaction-container");
  const modeSelect = document.getElementById("animation-mode");
  const speedSlider = document.getElementById("speed");
  const speedValue = document.getElementById("speed-value");
  const sendButton = document.getElementById("send-btn");
  const burstButton = document.getElementById("burst-btn");
  const icons = document.getElementById("reaction-icons").content.children;
  const gsap = window.gsap;

  // ---- Flight settings (kept in sync with the CSS @keyframes) ----
  const FLIGHT_DURATION = 3; // seconds
  const SWAY_POSITIONS = [-30, 20, -20, 0]; // px, one per quarter of the flight
  const START_SIZE = 24; // px, matches .reaction font-size
  const END_SIZE = 32; // px, matches the 100% keyframe font-size
  const BURST_COUNT = 60;

  // ---- State ----
  // Every running GSAP timeline, so the speed slider and mode switch can reach them.
  const activeTimelines = new Set();
  // How far a GSAP reaction travels upward, in px. Updated when the stage resizes.
  let flightDistance = 0;

  // Read the spawn height and top gap from CSS so GSAP flights end at the
  // same height as the CSS keyframe flights.
  function measureFlightDistance() {
    const styles = getComputedStyle(container);
    const spawnBottom = parseFloat(styles.getPropertyValue("--spawn-bottom"));
    const topGap = parseFloat(styles.getPropertyValue("--flight-top-gap"));
    flightDistance = Math.max(0, container.clientHeight - spawnBottom - topGap);
  }

  function isGsapMode() {
    return modeSelect.value === "gsap";
  }

  // Build one reaction element with a random icon and a random start position.
  function createReaction(useGsap) {
    const reaction = document.createElement("div");
    reaction.classList.add("reaction", useGsap ? "reaction--gsap" : "reaction--css");
    reaction.style.left = `${60 + Math.random() * 20}%`;

    const icon = icons[Math.floor(Math.random() * icons.length)];
    reaction.appendChild(icon.cloneNode(true));
    return reaction;
  }

  // CSS mode: the keyframes start as soon as the element is in the DOM.
  // We only need to remove the element when the animation finishes.
  function prepareCssFlight(reaction) {
    reaction.addEventListener("animationend", () => reaction.remove(), { once: true });
  }

  // GSAP mode: build a timeline that moves the reaction with transforms only.
  function startGsapFlight(reaction) {
    const timeline = gsap.timeline({
      paused: true, // Start paused so the current speed is applied before it plays.
      defaults: { ease: "none", force3D: true },
    });

    // Clean up on a normal finish (onComplete) or when killed by a mode switch (onInterrupt).
    function removeReaction() {
      activeTimelines.delete(timeline);
      reaction.remove();
    }
    timeline.eventCallback("onComplete", removeReaction);
    timeline.eventCallback("onInterrupt", removeReaction);

    const quarter = FLIGHT_DURATION / SWAY_POSITIONS.length;

    // Rise and grow over the whole flight.
    timeline.to(reaction, { y: -flightDistance, scale: END_SIZE / START_SIZE, duration: FLIGHT_DURATION }, 0);

    // Sway: move to one x position per quarter of the flight.
    SWAY_POSITIONS.forEach((x, index) => {
      timeline.to(reaction, { x, duration: quarter }, index * quarter);
    });

    // Fade out during the last quarter.
    timeline.to(reaction, { opacity: 0, duration: quarter }, FLIGHT_DURATION - quarter);

    activeTimelines.add(timeline);
    timeline.timeScale(Number(speedSlider.value)).play();
  }

  // Create `count` reactions in the current mode and start their flights.
  function spawnReactions(count) {
    const useGsap = isGsapMode();
    const reactions = Array.from({ length: count }, () => createReaction(useGsap));

    if (!useGsap) {
      reactions.forEach(prepareCssFlight);
    }

    // Add all reactions in one DOM operation.
    container.append(...reactions);

    // GSAP flights start after the elements are in the DOM.
    if (useGsap) {
      reactions.forEach(startGsapFlight);
    }
  }

  // Show the slider value and apply it to every reaction that is already flying.
  function updateSpeed() {
    const speed = Number(speedSlider.value);
    speedValue.value = `${speed.toFixed(1)}×`;
    for (const timeline of activeTimelines) {
      timeline.timeScale(speed);
    }
  }

  // Remove every reaction so the next mode starts on an empty stage.
  function clearStage() {
    // Killing a timeline triggers its onInterrupt cleanup.
    for (const timeline of activeTimelines) {
      timeline.kill();
    }
    // Also removes CSS reactions, which have no timeline.
    container.replaceChildren();
  }

  // The speed slider only controls GSAP timelines, so it is disabled in CSS mode.
  function switchMode() {
    clearStage();
    speedSlider.disabled = !isGsapMode();
    speedSlider.value = "1.0";
    updateSpeed();
  }

  // ---- Startup ----

  // If GSAP failed to load, only CSS mode is available.
  if (!gsap) {
    modeSelect.querySelector('option[value="gsap"]').disabled = true;
    modeSelect.value = "css";
  }

  measureFlightDistance();
  new ResizeObserver(measureFlightDistance).observe(container);
  speedSlider.disabled = !isGsapMode();
  updateSpeed();

  sendButton.addEventListener("click", () => spawnReactions(1));
  burstButton.addEventListener("click", () => spawnReactions(BURST_COUNT));
  modeSelect.addEventListener("change", switchMode);
  speedSlider.addEventListener("input", updateSpeed);
})();
