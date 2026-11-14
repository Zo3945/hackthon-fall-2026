// Turns readings into a plain-words verdict anyone can understand.

export function health({ temp, doPct, turb, ph, rain }) {
  let score = 100;
  const issues = [];

  if (doPct != null) {
    if (doPct < 40) { score -= 45; issues.push('Oxygen is very low, so fish struggle to breathe.'); }
    else if (doPct < 70) { score -= 18; issues.push('Oxygen is a bit low.'); }
    else if (doPct > 140) { score -= 8; issues.push('There is a lot of oxygen, usually from algae in the sun.'); }
  }
  if (turb != null) {
    if (turb > 40) { score -= 25; issues.push(rain > 0.3 ? 'The water is murky, likely from rain washing soil in.' : 'The water is murky.'); }
    else if (turb > 15) { score -= 8; issues.push('The water is a little cloudy.'); }
  }
  if (ph != null && (ph < 6.5 || ph > 8.5)) { score -= 15; issues.push('The water is more acidic than fish like.'); }
  if (temp != null && temp > 24) { score -= 12; issues.push('The water is warm, which holds less oxygen.'); }

  score = Math.max(0, Math.min(100, score));
  let mood;
  if (score >= 85) mood = 'The pond is happy today';
  else if (score >= 65) mood = 'The pond is doing okay';
  else if (score >= 45) mood = 'The pond is stressed';
  else mood = 'The pond is struggling';

  const calm = temp != null && temp < 3 ? 'Nearly frozen, but clear and calm.' : temp != null && temp < 6 ? 'Cold, clear, and calm.' : 'Clear water, plenty of oxygen, nothing unusual.';
  return { score, mood, why: issues.length ? issues.join(' ') : calm };
}

export const cloudiness = (v) => (v < 5 ? 'Clear' : v < 15 ? 'Slightly cloudy' : v < 40 ? 'Cloudy' : 'Murky');
// Conductivity in µS/cm. The cut-offs are our own plain-words labels for a freshwater pond.
export const saltiness = (v) => (v < 300 ? 'Low' : v < 800 ? 'Normal' : v < 1500 ? 'Salty' : 'Very salty');
export const toF = (c) => (c * 9) / 5 + 32;
