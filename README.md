# Livestream Reaction Engine — Submission

## 1. Setup & Running Instructions

1. Open `index.html` in Google Chrome. The included GSAP 3.13.0 build lets both modes run with no installation or internet connection. [GSAP Standard License](https://gsap.com/standard-license/)
2. Choose **CSS keyframes** or **GSAP** under **Engine**. Click **Send Reaction** to see one flight, or **Send 60 Reactions** to test concurrency. Switching engines clears the stage and resets speed to `1.0×` for a fresh run.
3. In **GSAP** mode, move **Speed** to `0.1×` while a burst is rising. The icons continue from their current positions at one tenth speed. At `1.0×`, each flight lasts three seconds. A new flight started at `0.1×` takes about 30 seconds.

To reproduce the comparison, open **Show Rendering** from the DevTools Command Menu and enable **Paint Flashing** and **Frame Rendering Stats**. Open **Performance**, set **CPU** to **6× slowdown** under Capture settings, and record one **Send 60 Reactions** burst in each engine at normal speed. Stop after the icons disappear. Use the same viewport for both recordings and run the slow-motion check separately. [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference/)

## 2. Phase 1: CSS Keyframes Analysis

### Benchmark at 6× CPU slowdown

The reactions looked choppy and DevTools showed substantial paint activity during the initial interactive CSS run. For the comparison below, I re-recorded CSS mode using the final shared SVG assets. Both profiles used headless Chrome 157 on Windows, a 1136 × 730 viewport, 6× CPU slowdown, Paint Flashing, and Frame Rendering Stats. Each run spawned 60 of the same seeded icons and start positions at `1.0×`. Both runs reached 60 active elements and cleaned up to zero.

The recording shows repeated **Recalculate Style**, **Layout**, and **Paint** on the main thread throughout the burst. The table covers the time between the spawn and cleanup marks.

| Main-thread event | CSS count | CSS total time | GSAP count | GSAP total time |
| --- | ---: | ---: | ---: | ---: |
| Recalculate Style (`UpdateLayoutTree` in the trace) | 15 | 1,046.1 ms | 216 | 568.4 ms |
| Layout | 15 | 265.0 ms | 1 | 23.4 ms |
| Paint | 915 | 589.7 ms | 61 | 38.7 ms |

### Why the burst stutters

`bottom` controls upward travel, `margin-left` controls sway, and `font-size` controls growth. Changing these properties forces Chrome to update the geometry of the moving icons. Those changes can also invalidate pixels where the icons were drawn. The screenshot shows overlapping green rectangles clustered to the right of center, along the reactions' flight paths. The title and control bar show no green in that capture.

### Evidence

- [Paint Flashing screenshot](evidence/phase-1-css-paint-flashing.png) captured during a separate 60-reaction burst with the same viewport and throttling settings.
- [CSS flame chart screenshot](evidence/phase-1-css-flame-chart.png) with the **Main** track expanded.
- [Chrome Performance recording](evidence/phase-1-css-performance.json.gz). In Chrome DevTools, open **Performance**, click **Load trace**, and select this file. Expand **Main** and look between **CSS: spawn 60 reactions** and **CSS: all reactions removed**.

## 3. Phase 2: GSAP & Composited Rendering Analysis

Both modes now clone the same four SVGs from an HTML template. In GSAP mode, the icon's starting position and size are set when it is created. Its timeline animates `y` and `scale` over three seconds, runs four `x` waypoints for the sway, and animates `opacity` during the last quarter. At completion, the callback removes both the element and its timeline reference. Chrome can composite the transform and opacity updates on the prepared layers while GSAP still uses JavaScript to advance the values. [GSAP CSSPlugin documentation](https://gsap.com/docs/v3/GSAP/CorePlugins/CSS/)

### Observations at 6× CPU slowdown

- The CSS flame chart shows repeated Layout and Paint throughout the burst. In the GSAP trace, Layout appears once and the main thread spends much less time painting. GSAP's writes still generate style updates, so the flame chart has JavaScript and style work during flight.
- The median gap between `requestAnimationFrame` callbacks fell from **207.1 ms** in CSS mode to **66.7 ms** in GSAP mode during the recordings. GSAP delivered callbacks more often under this workload. The screenshots include momentary FPS overlay readings from separate bursts. The callback gaps measure cadence over the recorded bursts.
- The GSAP screenshot shows the icons in flight without the green trails visible in the CSS capture. Chrome still has to paint the icons to create their layer contents and can then move, scale, and blend those layers during the flight.

### Mid-flight speed check

In a separate 6× CPU test, I started a 60-reaction GSAP burst at `1.0×`, then changed the slider to `0.1×` while the icons were ascending. All 60 timelines picked up the new speed with no position jump at the change. A sampled icon traveled about 97 px over 400 ms before the change and about 10 px over the next 400 ms. Setting the slider to `2.0×` finished the burst and left zero reaction elements and zero active timelines.

### Evidence

- [GSAP Paint Flashing screenshot](evidence/phase-2-gsap-paint-flashing.png) captured during a separate 60-reaction burst.
- [GSAP flame chart screenshot](evidence/phase-2-gsap-flame-chart.png) with the **Main** track expanded.
- [Chrome Performance recording](evidence/phase-2-gsap-performance.json.gz). Look between **GSAP: spawn 60 reactions** and **GSAP: all reactions removed** in the **Main** track.

## 4. Architectural Reflection

### Runtime control and developer experience

CSS keyframes express the fixed flight in one rule, and CSS custom properties can provide per-icon offsets when the elements are created. Live speed changes and mid-flight edits require tracking each animation and its current progress. For example, the Web Animations API can expose a CSS animation's playback rate. Here, GSAP provides an explicit playhead and `timeScale()` for each flight. The range input updates every active timeline and supplies the initial speed for new flights. To redirect a reaction mid-flight, I would read its current position and start a new segment from there so its path changes smoothly. [GSAP timeline documentation](https://gsap.com/docs/v3/GSAP/Timeline/)

### Vector assets and the rendering pipeline

The SVG `viewBox` defines a coordinate system for each icon, and its paths can be drawn at different display densities and sizes. Most paths use `currentColor`, so a theme can change the icon colors with CSS. I would apply palette changes when the theme changes and keep the flight on transform and opacity. Updating an SVG's fill or path while it moves can require paint again, and promoting many separate moving icons consumes layer memory. A raster sequence can make sense for complex artwork with a fixed look, but supporting multiple themes and resolutions would require extra variants or a runtime tinting system.
