// What each animal or cloud shows when you click it, written for kids.
// The main line is a fact that belongs to that animal. Under it is the live reading it stands for.

import { toF } from './health.js';

const deg = (c) => `${toF(c).toFixed(0)}°F`;
const pick = (list, id) => list[id % list.length];

// Short facts about the kinds of animals found in ponds around Westchester County, New York.
// They are general facts about each species, not a survey of what lives in Choate Pond.
// Sources are listed in the README.
export const FACTS = {
  fish: [
    'Fish breathe air that is mixed into the water.',
    'Cold water holds more air for fish than warm water.',
    'Sunfish dads build a nest and guard the eggs.',
    'Pond water has the least air just before sunrise.',
    'Salt from winter roads can wash into ponds.',
    'Sunfish have a dark "ear" spot on each side of the head.',
    "Fish don't have eyelids, so they sleep with their eyes open.",
    'Fish feel ripples with a line of tiny sensors along their sides.',
    "You can tell a fish's age from rings on its scales, like a tree.",
  ],
  turtle: [
    "Turtles sunbathe to warm up. They can't make their own heat.",
    'Turtles sleep in the mud all winter.',
    "The snapping turtle is New York's state reptile.",
    'A warm nest hatches girl turtles. A cool nest hatches boys.',
    'Painted turtles live in ponds all over New York.',
  ],
  goose: [
    'Lots of New York geese stay here all year.',
    "In summer, geese lose their wing feathers and can't fly for weeks.",
    'Geese love to eat grass.',
    'Goose parents usually stay together for life.',
    "When a pond freezes, geese find water that isn't frozen.",
  ],
};

// Why the fish are where they are right now
const FISH_WHERE = {
  surface: 'Up at the top, gulping for air',
  cold: 'Staying deep, where the water is warmest in winter',
  storm: 'Staying deep, away from the storm',
  hot: 'Staying deep, where it is cooler',
  night: 'Resting low for the night',
  normal: 'Swimming all over the pond',
};

const CLOUD_FACTS = [
  'Clouds are made of tiny drops of water floating in the air.',
  'Rain adds fresh water to the pond.',
  'Rain can wash soil into a pond and make the water cloudy.',
  'Thunder is the sound that lightning makes.',
  'Count the seconds from lightning to thunder. About five seconds means one mile away.',
  'Wind pushes clouds across the sky.',
  'A weather station beside the pond measures the rain.',
  'Raindrops stir air into the top of the water.',
  'Storm clouds look dark because they are thick with water.',
];

const FISH_NAMES = ['Sunny', 'Finn', 'Pebble', 'Goldie', 'Bubbles', 'Splash', 'Dot', 'Pumpkin', 'Ripple'];
const TURTLE_NAMES = ['Mossy', 'Shelly'];
const GOOSE_NAMES = ['Maple', 'Hudson', 'Birch'];

/** Returns { title, fact, reading } for the clicked animal. */
export function describe(hit, f) {
  const id = hit.id ?? 0;
  const water = f.temp == null ? 'no reading' : deg(f.temp);

  if (hit.kind === 'moon') {
    const p = hit.phase;
    const name = p < 0.03 || p > 0.97 ? 'New moon' : p < 0.22 ? 'Waxing crescent' : p < 0.28 ? 'First quarter' : p < 0.47 ? 'Waxing gibbous'
      : p < 0.53 ? 'Full moon' : p < 0.72 ? 'Waning gibbous' : p < 0.78 ? 'Last quarter' : 'Waning crescent';
    return {
      title: 'The moon',
      fact: 'The moon takes about a month to go from new to full and back again.',
      reading: `${name}, ${(hit.lit * 100).toFixed(0)}% lit. Worked out from the date, not from a pond sensor.`,
    };
  }

  if (hit.kind === 'cloud') {
    const rain = f.rain ?? 0;
    const snow = rain >= 0.05 && (f.air ?? 10) <= 0.5; // below freezing, it falls as snow
    const howHard = rain < 0.05 ? 'none' : snow ? (rain < 1 ? 'light snow' : 'steady snow') : rain < 2 ? 'a light shower' : rain < 8 ? 'steady rain' : 'a downpour';
    const strikes = f.lightning > 0 ? ` Lightning strikes counted: ${f.lightning.toFixed(0)}.` : ' No lightning.';
    return {
      title: snow ? 'Snow cloud' : 'Rain cloud',
      fact: pick(CLOUD_FACTS, id),
      reading: snow
        ? `Snow this hour: ${howHard}, ${rain.toFixed(1)} mm once melted. The air is ${deg(f.air)}.`
        : `Rain this hour: ${rain < 0.05 ? '' : `${rain.toFixed(1)} mm, `}${howHard}.${strikes}`,
    };
  }

  if (hit.kind === 'fish') {
    const o = f.doPct;
    const word = o == null ? '' : o < 40 ? ', very low' : o < 70 ? ', a bit low' : ', plenty';
    return {
      title: `${pick(FISH_NAMES, id)} the sunfish`,
      fact: pick(FACTS.fish, id),
      reading: `${o == null ? 'Air in the water right now: no reading' : `Air in the water right now: ${o.toFixed(0)}%${word}`}. ${FISH_WHERE[hit.where] ?? FISH_WHERE.normal}.`,
    };
  }

  if (hit.kind === 'turtle') {
    const doing = hit.mode === 'bask' ? 'warm enough to sunbathe' : hit.mode === 'rest' ? 'too cold to move much' : 'cool, so swimming slowly';
    return {
      title: `${pick(TURTLE_NAMES, id)} the painted turtle`,
      fact: pick(FACTS.turtle, id * 2 + 1),
      reading: `Water right now: ${water}, ${doing}`,
    };
  }

  const weather = !hit.sheltering ? 'calm enough to paddle' : f.rain > 1.5 ? 'raining hard, so hiding' : 'very windy, so hiding';
  return {
    title: `${pick(GOOSE_NAMES, id)} the Canada goose`,
    fact: pick(FACTS.goose, id * 2),
    reading: `Right now: ${weather}. Water ${water}`,
  };
}
