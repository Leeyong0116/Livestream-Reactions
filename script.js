
(() => {
  const container = document.getElementById("reaction-container");
  const modeSelect = document.getElementById("animation-mode");
  const speedSlider = document.getElementById("speed");
  const speedValue = document.getElementById("speed-value");
  const icons = document.getElementById("reaction-icons").content.children;
  const gsap = window.gsap;
  const activeTimelines = new Set();
  const flightDuration = 3;
  const swayPositions = [-30, 20, -20, 0];
  let flightDistance = 0;

  function measureFlightDistance() {
    const styles = getComputedStyle(container);
    const spawnBottom = parseFloat(styles.getPropertyValue("--spawn-bottom"));
    const topGap = parseFloat(styles.getPropertyValue("--flight-top-gap"));
    flightDistance = Math.max(0, container.clientHeight - spawnBottom - topGap);
  }

  function createReaction(useGsap) {
    const reaction = document.createElement("div");
    reaction.classList.add("reaction", useGsap ? "reaction--gsap" : "reaction--css");
    reaction.style.left = `${60 + Math.random() * 20}%`;
    const icon = icons[Math.floor(Math.random() * icons.length)];
    reaction.appendChild(icon.cloneNode(true));

    if (!useGsap) {
      reaction.addEventListener("animationend", () => reaction.remove(), { once: true });
    }

    return reaction;
  }

  function startGsapFlight(reaction) {
    function removeReaction() {
      activeTimelines.delete(timeline);
      reaction.remove();
    }

    const timeline = gsap.timeline({
      paused: true,
      defaults: { ease: "none", force3D: true },
      onComplete: removeReaction,
      onInterrupt: removeReaction,
    });
    const quarter = flightDuration / swayPositions.length;

    timeline.to(reaction, { y: -flightDistance, scale: 32 / 24, duration: flightDuration }, 0);
    swayPositions.forEach((x, index) => {
      timeline.to(reaction, { x, duration: quarter }, index * quarter);
    });
    timeline.to(reaction, { opacity: 0, duration: quarter }, flightDuration - quarter);

    activeTimelines.add(timeline);
    timeline.timeScale(Number(speedSlider.value)).play();
  }

  function spawnReactions(count) {
    const useGsap = modeSelect.value === "gsap";
    const reactions = Array.from({ length: count }, () => createReaction(useGsap));
    container.append(...reactions);

    if (useGsap) {
      reactions.forEach(startGsapFlight);
    }
  }

  function updateSpeed() {
    const speed = Number(speedSlider.value);
    speedValue.value = `${speed.toFixed(1)}×`;
    for (const timeline of activeTimelines) {
      timeline.timeScale(speed);
    }
  }

  if (!gsap) {
    modeSelect.querySelector('option[value="gsap"]').disabled = true;
    modeSelect.value = "css";
  }

  measureFlightDistance();
  new ResizeObserver(measureFlightDistance).observe(container);
  speedSlider.disabled = modeSelect.value !== "gsap";
  updateSpeed();

  document.getElementById("send-btn").addEventListener("click", () => spawnReactions(1));
  document.getElementById("burst-btn").addEventListener("click", () => spawnReactions(60));
  modeSelect.addEventListener("change", () => {
    for (const timeline of activeTimelines) {
      timeline.kill();
    }
    container.replaceChildren();
    speedSlider.disabled = modeSelect.value !== "gsap";
    speedSlider.value = "1.0";
    updateSpeed();
  });
  speedSlider.addEventListener("input", updateSpeed);
})();


