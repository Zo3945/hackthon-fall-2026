// "Ask the pond": answers plain questions from the real readings.
// No AI service is involved. The code works out two things from the question:
//   1. WHEN is being asked about (right now, last night, yesterday, a weekday, this week)
//   2. WHAT is being asked about (health, oxygen, temperature, clarity, pH, rain, wind)
// then reads those hours from the data and writes a sentence, speaking as the pond.

import { cloudiness, health, toF } from './health.js';

const TZ = 'America/New_York';
const dayKey = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
const hourOf = (ms) => Number(new Date(ms).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ })) % 24;
const weekdayOf = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ });
const whenText = (ms) => `${weekdayOf(ms)} at ${new Date(ms).toLocaleString('en-US', { hour: 'numeric', timeZone: TZ })}`;
const deg = (c) => `${toF(c).toFixed(0)}°F`;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const SUGGESTIONS = [
  'How are you right now?',
  'How was last night?',
  'Can the fish breathe?',
  'When were you warmest this week?',
  'Did it rain this week?',
];

/** Step 1: which hours of the data is the question about? */
function pickWindow(q, series, isLive) {
  const hours = Array.from({ length: series.n }, (_, i) => {
    const ms = series.timeAt(i);
    return { i, key: dayKey(ms), hour: hourOf(ms), weekday: weekdayOf(ms).toLowerCase() };
  });
  const days = [...new Set(hours.map((h) => h.key))];
  const today = days[days.length - 1], yesterday = days[days.length - 2];
  const pick = (label, be, test) => ({ label, be, ids: hours.filter(test).map((h) => h.i) });

  if (/last night|overnight/.test(q)) return pick('Last night', 'I was', (h) => (h.key === yesterday && h.hour >= 20) || (h.key === today && h.hour < 6));
  if (/yesterday/.test(q)) return pick('Yesterday', 'I was', (h) => h.key === yesterday);
  if (/this morning/.test(q)) return pick('This morning', 'I was', (h) => h.key === today && h.hour >= 5 && h.hour < 12);
  const named = WEEKDAYS.find((d) => q.includes(d));
  if (named) {
    const day = [...days].reverse().find((k) => k !== today && hours.some((h) => h.key === k && h.weekday === named)) ?? today;
    return pick(`On ${named[0].toUpperCase()}${named.slice(1)}`, 'I was', (h) => h.key === day && h.weekday === named);
  }
  if (/week|7 days|lately|recently|past few days/.test(q)) return pick('Over the past week', 'I was', () => true);
  if (/today/.test(q)) return pick('Today', "I've been", (h) => h.key === today);
  return { label: isLive ? 'Right now' : 'At my last recorded reading', be: isLive ? "I'm" : 'I was', ids: [series.n - 1], now: true };
}

/** Average, lowest and highest value of one column over the chosen hours. */
function stats(series, col, ids) {
  const s = series.col(col);
  let sum = 0, count = 0, min = Infinity, max = -Infinity, minAt = -1, maxAt = -1;
  for (const i of ids) {
    const v = s[i];
    if (v == null) continue;
    sum += v; count++;
    if (v < min) { min = v; minAt = i; }
    if (v > max) { max = v; maxAt = i; }
  }
  return count ? { avg: sum / count, sum, min, max, minAt, maxAt, count } : null;
}

const oxygenWord = (v) => (v < 40 ? 'very low' : v < 70 ? 'a bit low' : v > 140 ? 'very high' : 'healthy');

/** Step 2: what is the question about? First match wins. */
const TOPICS = [
  ['safe', /safe|swim|drink|bacteria|coli|toxic|pollut|poison/],
  ['fish', /fish|breath|geese|goose|turtle|animal|wildlife/],
  ['oxygen', /oxygen|\bo2\b/],
  ['temp', /temp|warm|cold|hot|cool|freez|degree|chilly/],
  ['clarity', /murk|clear|cloud|dirty|clean|turbid|mudd/],
  ['ph', /\bph\b|acid|alkalin/],
  ['rain', /rain|storm|pour|wet/],
  ['wind', /wind|breez|gust/],
  ['health', /how (are|were|was|is)|how's|health|doing|feel|okay|\bok\b|stress|happy|mood|well/],
];

/**
 * Answer a question. Returns { text, pos } where pos (optional) is an hour in the
 * data that the "Show me" button can jump to.
 */
export function answer(question, series, isLive) {
  const q = question.toLowerCase().trim();
  if (!q) return { text: 'Ask me something, like "How was last night?"' };
  const topic = TOPICS.find(([, pattern]) => pattern.test(q))?.[0];
  let win = pickWindow(q, series, isLive);
  const wantsMoment = /\bwhen\b|what time|warmest|hottest|coldest|lowest|highest|worst|murkiest|clearest|windiest/.test(q);
  if (wantsMoment && win.now) win = pickWindow('week', series, isLive); // "when" needs a span of time to search

  const get = (col) => stats(series, col, win.ids);
  const temp = get('Temp'), oxy = get('DOpct'), turb = get('Turb'), ph = get('pH'), rain = get('Rain'), wind = get('WindSpeed');
  if (!temp && !oxy) return { text: `${win.label}, my sensor was offline, so I have no readings to answer with.` };
  const { label, be } = win;
  const span = !win.now; // true when averaging over several hours

  switch (topic) {
    case 'safe':
      return { text: "I can't tell you that. My sensors measure temperature, oxygen, cloudiness, acidity and salt, but not germs or chemicals, so they can't say whether I'm safe to swim in or drink." };

    case 'fish':
    case 'oxygen': {
      if (!oxy) break;
      if (wantsMoment) {
        const low = !/highest|most|best/.test(q);
        const at = low ? oxy.minAt : oxy.maxAt;
        return { text: `My oxygen was ${low ? 'lowest' : 'highest'} on ${whenText(series.timeAt(at))}, at ${(low ? oxy.min : oxy.max).toFixed(0)}% of what the water can hold.`, pos: at };
      }
      const level = span ? `averaged ${oxy.avg.toFixed(0)}% and dipped to ${oxy.min.toFixed(0)}%` : `is at ${oxy.avg.toFixed(0)}%`;
      const worst = span ? oxy.min : oxy.avg;
      const fishLine = worst < 40 ? 'That is low enough that fish struggle to breathe.' : worst < 70 ? 'Fish can cope with that, but it is not comfortable.' : 'That is plenty for fish to breathe easily.';
      return { text: `${label}, my oxygen ${level} of what the water can hold, which is ${oxygenWord(worst)}. ${fishLine}`, pos: span ? oxy.minAt : undefined };
    }

    case 'temp': {
      if (!temp) break;
      if (wantsMoment) {
        const cold = /cold|cool|lowest|freez|chill/.test(q);
        const at = cold ? temp.minAt : temp.maxAt;
        return { text: `My water was ${cold ? 'coldest' : 'warmest'} on ${whenText(series.timeAt(at))}, at ${deg(cold ? temp.min : temp.max)}.`, pos: at };
      }
      return { text: span
        ? `${label}, my water averaged ${deg(temp.avg)}, between ${deg(temp.min)} and ${deg(temp.max)}.`
        : `${label}, my water is ${deg(temp.avg)}.${temp.avg < 6 ? ' That is cold enough that turtles rest and geese move on.' : ''}` };
    }

    case 'clarity': {
      if (!turb) break;
      if (wantsMoment) {
        const clear = /clear|clean/.test(q);
        const at = clear ? turb.minAt : turb.maxAt;
        return { text: `My water was ${clear ? 'clearest' : 'murkiest'} on ${whenText(series.timeAt(at))}.`, pos: at };
      }
      const word = cloudiness(turb.avg).toLowerCase();
      const peak = span && turb.max > 40 && turb.avg <= 40 ? ` It did turn murky on ${whenText(series.timeAt(turb.maxAt))}.` : '';
      return { text: `${label}, my water ${span ? 'was' : 'is'} ${word}.${peak}${turb.avg > 15 ? ' Cloudy water usually means rain washed soil in.' : ''}`, pos: peak ? turb.maxAt : undefined };
    }

    case 'ph': {
      if (!ph) break;
      const kind = ph.avg < 6.5 ? 'a little more acidic than fish like' : ph.avg > 8.5 ? 'more alkaline than fish like' : 'in the comfortable range for fish';
      return { text: `${label}, my pH ${span ? 'averaged' : 'is'} ${ph.avg.toFixed(1)}, which is ${kind}. A pH of 7 is neutral.` };
    }

    case 'rain': {
      if (!rain) break;
      if (rain.sum < 0.1) return { text: `${label}, no rain fell on me.` };
      return { text: `${label}, ${rain.sum.toFixed(1)} mm of rain fell on me${span ? `, with the heaviest hour on ${whenText(series.timeAt(rain.maxAt))}` : ''}.`, pos: span ? rain.maxAt : undefined };
    }

    case 'wind': {
      if (!wind) break;
      if (wantsMoment) return { text: `It was windiest on ${whenText(series.timeAt(wind.maxAt))}.`, pos: wind.maxAt };
      const share = (wind.avg - 9) / 45; // 9 and 54 are about the calmest and windiest readings on record
      return { text: `${label}, it ${span ? 'was' : 'is'} ${share < 0.25 ? 'calm' : share < 0.55 ? 'breezy' : 'windy'} over my surface.` };
    }

    case 'health':
    default: {
      const problems = [];
      if (oxy && oxy.avg < 70) problems.push(`${oxy.avg < 40 ? 'very low' : 'low'} oxygen (${oxy.avg.toFixed(0)}%)`);
      if (turb && turb.avg > 15) problems.push(`${turb.avg > 40 ? 'murky' : 'cloudy'} water`);
      if (ph && (ph.avg < 6.5 || ph.avg > 8.5)) problems.push('acidity outside what fish like');
      if (temp && temp.avg > 24) problems.push('warm water that holds less oxygen');
      // Same scoring as the headline at the top of the page, so the two never disagree.
      const mood = health({ temp: temp?.avg, doPct: oxy?.avg, turb: turb?.avg, ph: ph?.avg }).mood.replace('The pond is ', '').replace(' today', '');
      const lead = topic ? '' : "I'm not sure what you're asking, so here is how I'm doing. ";
      const detail = problems.length ? `${mood === 'happy' ? 'One small thing' : 'The reason'}: ${problems.join(', ')}.` : 'Clear water, plenty of oxygen, nothing unusual.';
      const facts = temp ? ` My water ${span ? 'averaged' : 'is'} ${deg(temp.avg)}.` : '';
      const hint = topic ? '' : ' You can ask about oxygen, temperature, cloudiness, rain or wind, for now, last night, yesterday or this week.';
      return { text: `${lead}${label}, ${be} ${mood}. ${detail}${facts}${hint}` };
    }
  }
  return { text: `${label}, I have no reading for that.` };
}
