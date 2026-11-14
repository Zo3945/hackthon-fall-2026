# Demo script: The Pond Wakes Up (3 minutes)

Before you start: run `npm run dev`, open http://localhost:5173, turn the laptop volume up, and leave the start screen showing.

## 0:00 to 0:25: What it is and who it's for (slide)

"Choate Pond has sensors taking a reading every fifteen minutes. That data only matters if a normal person can understand it. So we built The Pond Wakes Up: a living picture of the pond that anyone can read at a glance. We built it for this hackathon, with potential to scale."

## 0:25 to 1:05: Live, right now

Click **Start with sound**.

"This is the pond right now, from the Blue CoLab API. The red tag is the time of the last reading."

Point as you talk:
- "The headline says how the pond is doing, in plain words."
- "Water color is temperature. The fish are oxygen. The waves and reeds are wind."
- "The piano is the data too. Warmer water plays in a higher key, and more oxygen means more notes. Each note sends a ring across the water."

Click a fish.

"Every animal can tell you what it stands for, with the real reading behind it."

## 1:05 to 2:20: Three moments from the record

Click **Biggest storm**.

"June 26, two in the morning. 17.7 millimeters of rain in one hour, and the weather station counted three lightning strikes. The fish go deep and the geese head for the reeds."

Click **Lowest oxygen**.

"June 14, four in the morning, warm water. Oxygen dropped to about 4 percent saturation. The fish are at the surface gulping, and listen to the piano: a few slow, dull notes."

Click **Snow day**.

"March 3. The station recorded precipitation with the air near freezing, so the app draws snow and turns the hills white."

## 2:20 to 2:50: How it's built, and what we were honest about

"It's JavaScript with React. The scene is drawn on a canvas and the sound is generated in the browser, with no audio files. A Python script cleans the recorded data: it removes spikes and a stretch where the oxygen sensor got stuck."

"Two things we want to be straight about. The animals are illustrations driven by the readings, not a wildlife count. And ice and snow are drawn from temperature, because there's no ice sensor."

"We built this with Claude as our AI tool, and we can explain any line."

## 2:50 to 3:00: Close

Click **Live now**.

"That's Choate Pond, right now. Thank you."

## If something goes wrong

- **No internet at startup:** the page keeps the recorded replay and labels it. If the connection drops after live mode loads, the last live series stays on screen. Use a Jump to button to open history, then skip the live part.
- **No sound:** click the **Sound** button once. If it still fails, say "the piano follows the same readings" and keep going.
- **Running long:** drop the Snow day.

## Numbers to have ready

- Live data: last 7 days from the Blue CoLab API, stations Alan (water) and Odin (weather).
- Recorded data: 3,601 hourly readings, February 1 to July 1, 2026.
- Columns used: temperature, dissolved oxygen, turbidity, pH, conductivity, plus rain, wind, air temperature and lightning strikes.
