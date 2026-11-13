// What each animal shows when you click it, written for kids.
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

const FISH_NAMES = ['Sunny', 'Finn', 'Pebble', 'Goldie', 'Bubbles', 'Splash', 'Dot', 'Pumpkin', 'Ripple'];
const TURTLE_NAMES = ['Mossy', 'Shelly'];
const GOOSE_NAMES = ['Maple', 'Hudson', 'Birch'];

/** Returns { title, fact, reading } for the clicked animal. */
export function describe(hit, f) {
  const id = hit.id ?? 0;
  const water = f.temp == null ? 'no reading' : deg(f.temp);

  if (hit.kind === 'fish') {
    const o = f.doPct;
    const word = o == null ? '' : o < 40 ? ', very low' : o < 70 ? ', a bit low' : ', plenty';
    return {
      title: `${pick(FISH_NAMES, id)} the sunfish`,
      fact: pick(FACTS.fish, id),
      reading: o == null ? 'Air in the water right now: no reading' : `Air in the water right now: ${o.toFixed(0)}%${word}`,
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
