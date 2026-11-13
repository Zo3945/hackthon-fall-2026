// What each animal says when you click it. Every line comes from the current readings.

import { toF } from './health.js';

const deg = (c) => `${toF(c).toFixed(0)}°F`;

// Local facts about the kinds of animals found in ponds around Westchester County, New York.
// They are general facts about each species, not a survey of what lives in Choate Pond.
// Sources are listed in the README.
export const FACTS = {
  fish: [
    "Fish like me are pumpkinseed sunfish. New York's conservation department calls us the state's most abundant and widespread sunfish.",
    'In spring, when the shallows warm to about 55°F, male sunfish clear a nest on the bottom and guard the eggs.',
    'Cold water holds more oxygen than warm water, so hot summer nights are the hardest time for us to breathe.',
    'Pond plants make oxygen in daylight and use it up at night, so oxygen is usually lowest just before dawn.',
    'Road salt from Westchester winters washes into ponds. Sensors pick it up as a jump in how well the water carries electricity.',
  ],
  turtle: [
    'Turtles like me are painted turtles, found in ponds across New York.',
    "We bask on logs because we can't make our own body heat. The sun does it for us.",
    'In winter we settle into the mud at the bottom and barely move until spring.',
    "My bigger neighbor, the common snapping turtle, has been New York's official state reptile since 2006.",
    'For painted turtles, the warmth of the nest decides whether the eggs hatch as males or females.',
  ],
  goose: [
    'Many Canada geese around New York are residents: we stay all year instead of migrating far.',
    "Between mid-June and late July we shed our wing feathers and can't fly for four to five weeks, so we stay close to water.",
    'We mostly eat grass, which is why you see us on lawns and playing fields.',
    'Goose pairs usually stay together for life.',
    'When a pond freezes over, we look for open water nearby.',
  ],
};

export function describe(hit, f) {
  const oxygen = f.doPct, temp = f.temp;

  if (hit.kind === 'fish') {
    let text;
    if (oxygen == null) text = 'The oxygen sensor is offline, so I can only guess how I feel.';
    else if (oxygen < 40) text = `I'm gasping at the surface. Oxygen is only ${oxygen.toFixed(0)}% of what the water can hold, too little for me to breathe well.`;
    else if (oxygen < 70) text = `I'm a bit sluggish. Oxygen is ${oxygen.toFixed(0)}% of what the water can hold, which is a little low.`;
    else text = `I'm swimming easily. Oxygen is ${oxygen.toFixed(0)}% of what the water can hold, plenty for me to breathe.`;
    if (f.turb != null && f.turb > 15) text += ' The water is cloudy, so I am harder to see.';
    return { title: 'Pumpkinseed sunfish', shows: 'I show dissolved oxygen', text, facts: FACTS.fish };
  }

  if (hit.kind === 'turtle') {
    const t = temp == null ? 'unknown' : deg(temp);
    const text = hit.mode === 'bask'
      ? `I'm basking on the log. The water is ${t} and the sun is out, so I come up to warm my shell.`
      : hit.mode === 'rest'
        ? `I'm resting with my head tucked in. The water is ${t}, too cold for me to be active.`
        : `I'm swimming slowly. The water is ${t}. I climb onto the log when it is 59°F or warmer and sunny.`;
    return { title: 'Painted turtle', shows: 'I show water temperature and sunshine', text, facts: FACTS.turtle };
  }

  const text = hit.sheltering
    ? `I'm sheltering by the reeds with my head down. ${f.rain > 1.5 ? 'It is raining hard' : 'The wind is strong'} right now.`
    : `I'm paddling around. It is calm enough, and the water is ${temp == null ? 'not being measured' : deg(temp)}. I leave when it drops near freezing, about 39°F.`;
  return { title: 'Canada goose', shows: 'I show wind, rain and cold', text, facts: FACTS.goose };
}
