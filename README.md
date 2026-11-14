# The Pond Wakes Up

**Real Choate Pond readings become an animated pond and a changing soundtrack.**

Built for the Pace Coding Club Friday the 13th Hackathon on November 13, 2026, with potential to scale. The project responds to Blue CoLab's theme, **“Right to Know What's in Our Water.”**

**Team:** Zoheb Khan and Nahim Cagua.

Instead of asking visitors to interpret a chart first, the app connects water and weather measurements to a scene they can explore. Water changes color, fish respond to oxygen, rain falls, and a procedural piano follows the same readings.

## Contents

- [Quick start](#quick-start)
- [Features and controls](#features-and-controls)
- [Technology stack](#technology-stack)
- [How the app works](#how-the-app-works)
- [Data sources and API](#data-sources-and-api)
- [Data preparation](#data-preparation)
- [Visual and sound mappings](#visual-and-sound-mappings)
- [Headline scoring](#headline-scoring)
- [Deployment on Vercel](#deployment-on-vercel)
- [Troubleshooting](#troubleshooting)
- [Current limitations and future work](#current-limitations-and-future-work)
- [Credits and references](#credits-and-references)

## Quick start

### Requirements

- Node.js **20.19+ within the 20.x release line, or 22.12+**. These requirements come from the installed Vite and React plugin packages.
- npm, included with Node.js.
- A modern browser with Canvas 2D and Web Audio support.
- Python 3 only if you want to regenerate the historical dataset.

### Install and run

```bash
git clone https://github.com/Zo3945/hackthon-fall-2026.git
cd hackthon-fall-2026
npm ci
npm run dev
```

The repository requires GitHub access while it remains private. Open **http://localhost:5173** after Vite starts.

The processed historical dataset is already committed, so normal installation does not require the raw CSVs or Python. Live readings need network access.

### Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the dependencies recorded in `package-lock.json` |
| `npm run dev` | Run the development server on port 5173 with live API forwarding |
| `npm run build` | Create the production website in `dist/` |
| `npm run preview` | Preview the built website locally on port 5173, including the configured proxy |
| `python3 scripts/prep_data.py 150` | Regenerate history using the final 150 days of available water CSV data |

Stop a local server with `Ctrl+C`. Both development and preview use a strict port, so only one can use port 5173 at a time.

## Features and controls

- **Live readings:** load the latest seven days from Blue CoLab and refresh every two minutes while in live mode.
- **Historical replay:** explore 3,601 hourly rows covering February 1 through July 1, 2026, in the committed dataset.
- **Animated pond:** temperature, oxygen, turbidity, weather, and time drive the scene.
- **Procedural sound:** the browser synthesizes piano, water, wind, thunder, crickets, and occasional frogs without audio files.
- **Clickable explanations:** fish, turtles, geese, rain clouds, and the moon reveal facts and the readings or calculations they represent.
- **Wind compass:** displays the direction the wind comes from and its speed in mph. The arrow points toward the direction it blows.
- **Plain-language headline:** summarizes selected readings using the project's scoring rules.

| Control | Behavior |
| --- | --- |
| Start with sound / Start without sound | Enter the scene with your preferred audio setting |
| Live / Live now | Switch between the recorded replay and the latest API series |
| Play / Pause | Advance or hold the current timeline |
| Timeline slider | Move through the active dataset |
| Playback speed | Cycle through four rates, from 0.5 to 24 recorded hours per second |
| Sound on / Sound off | Enable or mute generated audio |
| Jump to buttons | Switch to history and pause at a selected event |
| Click an animal, cloud, or moon | Open its explanation bubble |
| Space bar | Toggle playback when focus is outside buttons and text inputs |

“Real slow” is still accelerated playback at half a recorded hour per second. Live mode initially holds at the latest available hour rather than continuously advancing the clock.

The six historical events are **Biggest storm, Warmest water, Lowest oxygen, Murkiest water, Coldest day, and Snow day**. See [DEMO.md](DEMO.md) for a short presentation walkthrough.

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Interface | React 19 and JavaScript | Components, controls, labels, and state |
| Development and build | Vite 8 | Local server, React tooling, production bundling, and local API proxy |
| Graphics | HTML Canvas 2D | Draw the animated pond |
| Audio | Web Audio API | Synthesize music and environmental sounds |
| Styling | CSS | Layout, typography, controls, and responsive adjustments |
| Data preparation | Python 3 standard library | Clean and aggregate CSV files |
| Live data | Blue CoLab REST API | Read Alan water and Odin weather measurements |
| Replay data | Local JSON | Serve cleaned hourly history |
| Hosting configuration | Vercel | Serve `dist/` and forward live API requests |

The project has no custom database, user-account system, or separate application server. The live API belongs to Blue CoLab. A host-side proxy is required for browser access to that API.

## How the app works

1. `main.jsx` mounts the React app.
2. `App.jsx` creates the canvas and connects it to the controls and overlays.
3. `usePond.js` loads history, calculates its normalization ranges, finds event moments, and tries the live API.
4. `data.js` turns the active series and timeline position into a frame of readings.
5. `scene.js`, `audio.js`, and `health.js` interpret that frame as animation, sound, and text.
6. React components display the readings and respond to user interaction.

The canvas uses `requestAnimationFrame`. Fast-changing engine values live in a React ref, while interface snapshots update about every 120 milliseconds. This separates continuous drawing from less frequent text updates.

### Project structure

```text
src/
  main.jsx                  React entry point
  App.jsx                   Page composition and canvas interaction
  usePond.js                Data, playback, scene, audio, and selection controller
  styles.css                Page and component styling
  components/
    Header.jsx              Headline, date, live status, and gap message
    Dock.jsx                Timeline controls, event buttons, and readings
    Compass.jsx             Wind direction and speed
    Splash.jsx              Start screen and sound choice
    InfoBubble.jsx          Explanation for the selected creature or cloud
  lib/
    data.js                 Series model, API requests, frames, and event selection
    scene.js                Canvas animation and hit testing
    audio.js                Piano synthesis and environmental sounds
    health.js               Headline scoring and reading labels
    creatures.js            Creature names, facts, and explanations
scripts/
  prep_data.py              CSV cleaning and hourly JSON generation
public/data/
  pond.json                 Committed historical replay data
vite.config.js              Local server and API proxy configuration
vercel.json                 Production build and API routing configuration
DEMO.md                     Three-minute demo walkthrough
```

### Reading a frame

`Series` stores hourly rows and supports fractional timeline positions. Most values interpolate between adjacent hours. Wind direction uses a nearby hourly direction rather than interpolating through an incorrect compass heading. Lightning uses the selected hour's count.

`readFrame()` supplies fields such as `temp`, `doPct`, `turb`, `ph`, `cond`, `rain`, `wind`, `windDir`, `air`, `lightning`, `timeMs`, and `gap`. Both the scene and audio consume these same readings.

## Data sources and API

- **Alan:** water temperature, oxygen saturation, turbidity, pH, and conductivity.
- **Odin:** precipitation, wind speed and direction, air temperature, and lightning strike count.
- **Historical files:** [Blue CoLab data repository](https://github.com/bluecolab/data-repo).
- **API reference:** [Blue CoLab Swagger UI](https://colabprod01.pace.edu/api/docs).

### Endpoints used by the app

```text
GET https://colabprod01.pace.edu/api/mneme/sensordata/Alan/delta?days=7
GET https://colabprod01.pace.edu/api/mneme/sensordata/Odin/delta?days=7
```

`fetchLive()` in `src/lib/data.js` calls the equivalent same-origin `/api/...` routes. `vite.config.js` forwards them locally, and `vercel.json` forwards them in production. No API key or environment variable is currently required by these requests.

### Fields and units

| History column | Source | Stored unit or meaning |
| --- | --- | --- |
| `Temp` | Alan | Water temperature, °C |
| `DOpct` | Alan | Dissolved oxygen, percent saturation |
| `Turb` | Alan | Turbidity, NTU |
| `pH` | Alan | pH |
| `Cond` | Alan | Conductivity, µS/cm |
| `Rain` | Odin | Precipitation summed per hour, mm |
| `WindSpeed` | Odin | Wind speed, km/h |
| `AirTemp` | Odin | Air temperature, °C |
| `Lightning` | Odin `LightningStrikes` | Strikes summed per hour |
| `WindDir` | Odin | Direction wind comes from, degrees |

The interface converts temperatures to Fahrenheit where appropriate and wind speed to mph. Display dates use `America/New_York`.

**Conductivity is not a direct salinity or carbon measurement.** The interface uses “Salt in the water” as a simplified conductivity label. The current app does not use carbon, CO₂, direct salinity, humidity, solar radiation, or air-pollution readings.

### Live status and failures

- History loads first. If the initial live request fails, history remains available and the header reports replay.
- If Odin fails but Alan succeeds, the app can still load water readings. Missing weather may appear as no precipitation or use visual defaults.
- Later refresh failures retain the previous live series and log a warning. They do not automatically switch to history.
- A latest reading more than three hours old changes the header to “Sensor last reported at …”. A successful API response does not guarantee fresh measurements.
- Live values are hourly aggregates. The header can show the most recent source timestamp even though the scene represents the latest hourly bucket.

## Data preparation

The committed `public/data/pond.json` lets the app run without downloading the large raw files.

To regenerate it, download and extract the Alan and Odin archives from the [data repository](https://github.com/bluecolab/data-repo). The script expects the archive layout below:

```text
data/raw/extract/
  alan/alan/alan 20*.csv
  odin/odin/odin 2024.csv
  odin/odin/odin 2025.csv
  odin/odin/odin 2026.csv
```

The water filename glob accepts matching years. The current weather glob explicitly selects 2024–2026. Update it before processing later weather files. Raw data and generated build files are excluded by `.gitignore`.

Run:

```bash
python3 scripts/prep_data.py 150
```

The argument controls the number of days before the latest available water timestamp. Without an argument, the script uses 120 days. It overwrites `public/data/pond.json`, prints the date range, and summarizes missing values and ranges.

### Cleaning steps

1. Convert timestamps with their offsets into UTC hourly buckets.
2. Average water measurements, wind speed, and air temperature. Sum precipitation and lightning counts. Circular-average wind directions so 350° and 10° average near north.
3. Drop values outside the configured ranges.
4. Remove oxygen windows of six hours whose range is at most 0.15 percentage points. This is a stuck-sensor heuristic.
5. Use a rolling median and median absolute deviation to remove historical water spikes.
6. Interpolate bounded water gaps up to six hours and wind/air-temperature gaps up to twelve hours.
7. Keep longer water gaps as `null`. Missing rain and lightning become zero. Wind direction remains unfilled in the exported rows.
8. Write metadata and ordered hourly rows to JSON.

Live processing performs range filtering and stuck-oxygen detection, but does not apply the full historical spike-filtering pipeline.

### Important gap behavior

At display time, `Series.val()` can substitute a nearby measurement across an empty cell, searching backward and forward up to 399 hours. This may use a later reading, not strictly the last known reading. The offline indicator currently checks missing **temperature**, not every sensor. Missing precipitation is indistinguishable from a recorded zero after processing.

## Visual and sound mappings

| Input | Visual response | Audio response |
| --- | --- | --- |
| Water temperature | Cold blue to warmer green water, seasonal behavior, inferred ice | Higher musical key as water warms |
| Oxygen saturation | Fish energy and surface gulping below the chosen threshold | Fuller phrases and brighter piano tone with more oxygen |
| Turbidity | Brown tint, less visibility, weaker light shafts | Stronger, lower water wash |
| pH | Contributes to the headline | Changes the melody's target height |
| Wind | Waves, reeds, cloud drift, rain slant, and compass | Stronger airy noise |
| Rain | Clouds, falling rain, and surface ripples | High piano drips |
| Air temperature | Frost and inferred snow during precipitation | Temperature-dependent cricket activity on warm dry nights |
| Lightning | Flashes during hours with recorded strikes | Thunder after each simulated flash |
| Time and date | Approximate daylight, stars, and calculated moon phase | Night insects and occasional frogs under chosen conditions |
| Temperature gap | Offline message | Stops new piano phrases |

Fish also move deeper in cold water, storms, hot sunshine, and at night. Geese shelter in rain and wind and leave the scene near freezing. Turtles bask in warm sunny conditions and rest lower when cold. Dragonflies and fireflies appear under suitable simulated conditions.

Every sufficiently strong piano note creates a ring of light on the water. The melody uses a pentatonic scale, randomized phrases, synthesized overtones, filters, and reverb.

Wildlife counts and movement are illustrations, not observations. Snow and ice are temperature-based inferences, moon phase comes from the date, and lightning frequency on screen is illustrative rather than a timestamped replay of individual strikes.

## Headline scoring

`src/lib/health.js` starts at 100 points and applies these deductions:

| Condition | Deduction |
| --- | --- |
| Oxygen below 40% saturation | 45 |
| Otherwise, oxygen below 70% | 18 |
| Otherwise, oxygen above 140% | 8 |
| Turbidity above 40 NTU | 25 |
| Otherwise, turbidity above 15 NTU | 8 |
| pH outside 6.5–8.5 | 15 |
| Water temperature above 24°C | 12 |

The score is clamped to 0–100. Scores of 85+, 65+, and 45+ produce “happy,” “doing okay,” and “stressed.” Lower scores produce “struggling.” Conductivity does not affect this score.

These thresholds are project heuristics, not a validated ecological index or a drinking-water safety assessment. Missing readings skip their deductions. The current pH explanation incorrectly says “more acidic” for either low or high pH; high pH means more alkaline. This remains a documented improvement.

## Deployment on Vercel

The repository includes `vercel.json` with the production configuration:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| API route | `/api/:path*` forwards to `https://colabprod01.pace.edu/api/:path*` |

### Deploy

1. Sign in to Vercel and import `Zo3945/hackthon-fall-2026`.
2. Give Vercel access to the repository while keeping it private on GitHub.
3. Select `main` as the production branch and use the repository root.
4. Confirm the settings above and choose a supported Node.js version.
5. Deploy. Vercel provides the production URL after the build succeeds.

No environment variables are needed for the current app. The site must serve `/data/pond.json` and the API rewrite as well as JavaScript and CSS assets.

### Verify a deployment

- The start screen loads and both sound options work.
- Live mode displays a timestamp and measurements when the upstream API is available.
- `/api/mneme/sensordata/Alan/delta?days=7` returns JSON through the hosted domain.
- Historical event buttons switch to replay and pause at their chosen moments.
- Creature explanations and the wind compass work.
- A failed live connection leaves historical replay usable.

A successful production build alone does not verify the live API proxy. Plain static hosting, including GitHub Pages, cannot run Vite's development proxy. It needs an equivalent server-side route to support the live feed.

See [Vercel's Vite documentation](https://vercel.com/docs/frameworks/frontend/vite) and [external rewrites](https://vercel.com/docs/routing/rewrites).

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Port 5173 is already in use | Stop the other development or preview server, then restart |
| Dependency installation or Vite fails | Check Node.js against the requirements above and run `npm ci` |
| “Could not load pond data” | Verify `public/data/pond.json` exists and the deployed `/data/pond.json` returns JSON |
| Replay works but live fails | Check the upstream API and the local or production `/api/` proxy |
| Old live timestamp | The station may be stale even if its API is reachable |
| No sound | Use Start with sound or Sound on, check device volume, and allow browser audio after interaction |
| No animals respond to clicks | Click visible animals on the canvas rather than the control panel |
| Data preparation fails at `max(water)` | Check the extracted Alan file layout and filename pattern |
| History changes after regeneration | The script uses the latest timestamp in your supplied files; the date range and event moments can shift |

## Current limitations and future work

Built for the hackathon, with potential to scale. The following are possible next steps, not completed features:

- Expand station support and allow visitors to choose a location.
- Add per-sensor freshness and quality indicators, and distinguish missing weather from zero readings.
- Improve scientific wording and review thresholds with subject-matter experts.
- Add keyboard interaction for canvas creatures, reduced motion, and a text description of the scene.
- Use available direct salinity or additional weather readings where they improve understanding.
- Add automated tests for aggregation, gaps, event selection, and proxy routing.

The current project has no automated test script. `npm run build` verifies the production bundle; interactive behavior and live data still need manual checks. Python standard-library tools handle data preparation without third-party packages.

## Credits and references

**Project team:** Zoheb Khan and Nahim Cagua. Built with help from Claude (AI), with documentation and deployment assistance from Codex (AI).

**Data:** [Blue CoLab](https://github.com/bluecolab/data-repo), Alan water station and Odin weather station, Choate Pond at Pace University Pleasantville.

Animal facts are general descriptions of New York pond species, not a survey of Choate Pond. Existing project references include:

- [NYS DEC: Canada geese](https://dec.ny.gov/sites/default/files/2025-04/geeseproblem.pdf)
- [NYS DEC: Snapping turtle](https://dec.ny.gov/nature/animals-fish-plants/amphibians-reptiles/snapping-turtle)
- [NYS DEC: Freshwater sportfish](https://dec.ny.gov/sites/default/files/2026-08/freshwatersportfishbrochure.pdf)
- [Northern Woodlands: Spawning sunfish](https://northernwoodlands.org/outside_story/article/spawning-sunfish)

These references cover selected facts, not every statement in the app. Review educational claims before presenting them as scientific guidance.

### License

No project license is currently included. Do not assume permission to reuse the code or upstream datasets beyond their applicable terms.
