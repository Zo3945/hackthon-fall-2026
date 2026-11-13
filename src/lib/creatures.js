// What each animal says when you click it, written for kids.
// Every animal has its own name, its own way of talking and its own fact.
// The feelings always come from the current readings.

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

// Three ways to say each oxygen feeling, so neighbours don't repeat each other.
const FISH_FEELS = {
  good: [
    (o) => `I'm zooming around! There is lots of air in the water for me to breathe (${o}%).`,
    (o) => `Breathing is easy today. The water is full of air (${o}%).`,
    (o) => `I feel great! Plenty of air in the water right now (${o}%).`,
  ],
  low: [
    (o) => `I'm feeling slow. There isn't much air in the water right now (${o}%).`,
    (o) => `I'm a little tired. The water is running low on air (${o}%).`,
    (o) => `I'm taking it easy. There is less air in the water than I like (${o}%).`,
  ],
  bad: [
    (o) => `Help, I can't breathe well! There is almost no air in the water (${o}%), so I'm up at the top.`,
    (o) => `I'm gulping at the top of the pond. The water has almost no air left (${o}%).`,
    (o) => `This is scary. There is so little air in the water (${o}%) that I had to come up.`,
  ],
};

function fishSelf(hit) {
  if (hit.size > 1.2) return "I'm one of the biggest fish here.";
  if (hit.size < 0.78) return "I'm one of the smallest fish here, so I stay close to my friends.";
  if (hit.depth > 0.6) return 'I like it down deep, where it is quiet.';
  if (hit.depth < 0.35) return 'I like to swim near the top, where it is bright.';
  return 'I like the middle of the pond best.';
}

export function describe(hit, f) {
  const oxygen = f.doPct, temp = f.temp, id = hit.id ?? 0;
  const water = temp == null ? '' : ` The water is ${deg(temp)}.`;

  if (hit.kind === 'fish') {
    const level = oxygen == null ? null : oxygen < 40 ? 'bad' : oxygen < 70 ? 'low' : 'good';
    let text = level ? pick(FISH_FEELS[level], id)(oxygen.toFixed(0)) : "I can't tell how much air is in the water right now.";
    text = `${fishSelf(hit)} ${text}`;
    if (f.turb != null && f.turb > 15 && id % 2 === 0) text += " The water is cloudy, so I'm hard to spot.";
    return { title: `${pick(FISH_NAMES, id)} the sunfish`, shows: 'I show how much air is in the water', text, fact: pick(FACTS.fish, id) };
  }

  if (hit.kind === 'turtle') {
    const first = id === 0;
    const text = hit.mode === 'bask'
      ? (first ? `I'm sunbathing on my log!${water} The sun is out, so I'm warming my shell.` : `I got the sunny end of the log today.${water} This is my favorite spot.`)
      : hit.mode === 'rest'
        ? (first ? `Brrr!${water} I'm tucked in my shell, resting until it warms up.` : `Too cold for me.${water} I'm staying still to save my energy.`)
        : (first ? `I'm going for a slow swim.${water} When it's warm and sunny, I climb onto my log.` : `I'm the little one, paddling along.${water} I'm waiting for a warm, sunny day to sit on the log.`);
    return { title: `${pick(TURTLE_NAMES, id)} the painted turtle`, shows: 'I show how warm the water is', text, fact: pick(FACTS.turtle, id * 2 + 1) };
  }

  const weather = f.rain > 1.5 ? "It's raining hard" : "It's too windy";
  const text = hit.sheltering
    ? pick([`${weather}! I'm hiding by the reeds with my head down.`, `${weather} for me. I'm staying next to my friends by the reeds.`, `${weather}! I tucked my head in to stay warm.`], id)
    : pick([
      `I'm paddling around.${water} If it gets icy, I fly off to find water that isn't frozen.`,
      `I'm looking for something to nibble.${water} It's calm, so it's a good day for a swim.`,
      `I'm keeping watch while the others paddle.${water} When it gets windy, we all hide by the reeds.`,
    ], id);
  return { title: `${pick(GOOSE_NAMES, id)} the Canada goose`, shows: 'I show wind, rain and cold', text, fact: pick(FACTS.goose, id * 2) };
}
