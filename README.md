# The Pond Wakes Up

Pace Coding Club Friday the 13th Hackathon (11.13.2026). Theme: Blue CoLab, "Right to Know What's in Our Water".

A living picture of Choate Pond, driven by real sensor readings, for people who will never read a chart.

- Water color is temperature (cold blue to warm green).
- Murkiness is turbidity.
- Waves are wind, and rain falls when it rained.
- In winter the hills frost over, ice forms as the water nears freezing, and rain recorded below freezing falls as snow.
- Fish gulp at the surface when oxygen is low, and go deep in cold water, storms and hot sun.
- Geese paddle on the surface, shelter by the reeds in wind and rain, and leave when the water is near freezing.
- Turtles bask on a log on warm sunny days, swim when it is cooler, and rest low when the water is cold.
- Reeds bend with the wind, dragonflies come out on warm calm days, and fireflies on warm dry nights.
- The animals are illustrations driven by the readings, not counted wildlife.
- A plain-words message says how the pond is doing and why.
- Each piano note sends a ring of light across the water, and the piano goes silent when the sensor is offline.
- Conductivity is shown as "Salt in the water".
- Click a fish, turtle, goose or rain cloud to see a short fact and the live reading it stands for. The clicked one is highlighted and its bubble follows it.
- A slow piano follows the same readings: warmer water plays in a higher key, more oxygen means fuller phrases and a brighter tone, pH sets how high the melody sits, and rain adds high drips.
- Jump buttons hold on real moments in the recorded data: the biggest storm, the warmest water, the lowest oxygen, the murkiest water, the coldest day and a snow day.
- Lightning flashes only in hours when the weather station counted strikes.

## Run it

You need Node.js 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

The page opens on the live reading from the Blue CoLab API (https://colabprod01.pace.edu/api/docs) and refreshes every two minutes. The API does not allow direct calls from a browser, so the Vite dev server passes `/api/*` through to it (see `vite.config.js`). If the live feed is unreachable, the page falls back to the replay.

## How the code is organized

| File | What it does |
|---|---|
| `src/usePond.js` | One React hook that runs everything: data, live or replay mode, the playback clock, clicks on animals |
| `src/lib/data.js` | Loads the history, fetches live readings, reads a value at any moment, finds the jump-button moments |
| `src/lib/health.js` | Turns readings into the plain-words message |
| `src/lib/scene.js` | Draws the pond on a canvas |
| `src/lib/creatures.js` | Names, facts and readings shown when an animal or cloud is clicked |
| `src/lib/audio.js` | The piano and the water and wind sounds (Web Audio API) |
| `src/components/` | Header, control dock, start screen and the click bubble |
| `scripts/prep_data.py` | Cleans the raw CSVs into `public/data/pond.json` |

## Data

Real data only. Live mode uses the last 7 days from the Blue CoLab API (stations Alan and Odin). Replay uses the Blue CoLab flat files (https://github.com/bluecolab/data-repo): the Alan water station and the Odin weather station.

`scripts/prep_data.py` turns the raw CSVs into `public/data/pond.json`: hourly averages (rain and lightning strikes are hourly totals), impossible values dropped, sensor spikes removed with a rolling-median filter, stretches where the oxygen sensor was stuck on one value removed, short gaps filled, long gaps left empty and labeled "Sensor offline" in the app.

Judgment calls worth knowing: ice and snow are drawn from temperature, since there is no ice or snow sensor. The "Lowest oxygen" button only considers water above 50°F, because the near-zero readings in February follow a stuck-sensor stretch. The plain-words labels (such as "Cloudy", "Salty" and "a downpour") use cut-offs we chose.

```bash
python3 scripts/prep_data.py 150
```

The raw files are large and are not committed. Download and unzip them into `data/raw/extract/` first.

## Sources for the animal facts

The animals are illustrations, and the facts are general facts about species found in New York ponds, not a survey of Choate Pond. The sources below back the goose, snapping turtle and sunfish facts. The other facts are standard science that we did not look up.

- Canada geese (resident geese, summer molt): NYS Department of Environmental Conservation, https://dec.ny.gov/sites/default/files/2025-04/geeseproblem.pdf
- Snapping turtle as state reptile: NYS DEC, https://dec.ny.gov/nature/animals-fish-plants/amphibians-reptiles/snapping-turtle
- Pumpkinseed sunfish (most abundant and widespread sunfish in New York): NYS DEC freshwater sportfish brochure, https://dec.ny.gov/sites/default/files/2026-08/freshwatersportfishbrochure.pdf
- Sunfish nesting at about 55°F: Northern Woodlands, https://northernwoodlands.org/outside_story/article/spawning-sunfish

## Built with

React 19 and Vite. The scene uses the canvas and the sound uses the Web Audio API, with no other libraries. The data script is plain Python 3. Built with help from Claude (AI).
