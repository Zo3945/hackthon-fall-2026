# The Pond Wakes Up

A live, animated picture of Choate Pond at Pace University Pleasantville, driven by real sensor data. No charts.

**Live:** https://hackthon-fall-2026.vercel.app

Built in five hours for the Pace Coding Club Friday the 13th Hackathon (November 13, 2026). It won first place.

## What you're looking at

- **Water color:** the water temperature
- **Murky water:** the turbidity (how cloudy the water is)
- **Fish:** the oxygen level. They gulp at the surface when it's low.
- **Rain, snow, lightning and wind:** readings from the weather station by the pond
- **Piano:** plays the data. Warmer water raises the key, and more oxygen means more notes.
- **Jump to buttons:** real moments from the record, like the biggest storm and the lowest oxygen
- **Click any animal or cloud:** shows a fact and the reading behind it

## Where the data comes from

[Blue CoLab](https://github.com/bluecolab/data-repo) at Pace runs two stations at the pond:
- **Alan:** sensors in the water
- **Odin:** a weather station on the shore

- **Live mode** pulls the last 7 days from the Blue CoLab API.
- **Replay mode** uses `public/data/pond.json`: 3,601 hourly readings from February 1 to July 1, 2026, cleaned with `scripts/prep_data.py`.

## Run it

You need Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the app locally |
| `npm run build` | Builds the site into `dist/` |
| `npm run data` | Rebuilds `pond.json` from the raw CSVs in `data/raw/` (needs Python 3) |

## Files

```
src/usePond.js         runs everything: data, clock, live vs replay
src/lib/data.js        loads and reads the sensor data
src/lib/scene.js       draws the pond
src/lib/audio.js       makes the music
src/lib/creatures.js   what each animal says when clicked
src/lib/health.js      the plain-words mood line
src/components/        header, controls, compass, popups
scripts/prep_data.py   cleans the raw data
```

## Hosting

The site is hosted on Vercel and deploys automatically on every push to `main`. `vercel.json` passes `/api` calls through to the Blue CoLab API, because that API blocks direct calls from a browser.

## Good to know

- The animals are illustrations driven by the readings, not a wildlife count.
- Ice and snow are drawn from temperature, because there's no ice sensor.
- Animal facts are general facts about New York pond species, from sources like NYS DEC.

## Team

Zoheb Khan and Nahim Cagua. Built with help from Claude and Codex (AI). Data from Blue CoLab.
