// Shared level utilities — single source of truth for level display & coloring

// Supports legacy A/B/C and numeric L1-L12
export function levelIndex(level) {
  if (level === 'A') return 8;
  if (level === 'B') return 5;
  if (level === 'C') return 3;
  const n = parseInt(level);
  return isNaN(n) ? 5 : n;
}

export function displayLevel(level) {
  if (level === 'A' || level === 'B' || level === 'C') return level;
  return `L${level}`;
}

// Compute range from actual players array
export function getPlayerRange(players) {
  const levels = players.map(p => parseInt(p.level)).filter(n => !isNaN(n));
  if (levels.length < 2) return null;
  return { min: Math.min(...levels), max: Math.max(...levels) };
}

// Color relative to player range (low=綠, mid=黃, high=紅, outside=灰)
// range: { min, max } computed from actual players via getPlayerRange()
// withBorder: include border-* class (for chips/badges with visible border)
export function getLevelColor(level, sessionRange = null, withBorder = false) {
  const n = levelIndex(level);

  let tier;

  if (sessionRange && sessionRange.max > sessionRange.min) {
    const { min, max } = sessionRange;
    if (n < min || n > max) {
      tier = 'outside';
    } else {
      const pos = (n - min) / (max - min); // 0 = bottom, 1 = top
      if (pos <= 0.33) tier = 'low';
      else if (pos <= 0.67) tier = 'mid';
      else tier = 'high';
    }
  } else {
    // Absolute fallback (no range configured)
    if (n >= 9) tier = 'high';
    else if (n >= 5) tier = 'mid';
    else tier = 'low';
  }

  if (tier === 'outside') {
    return withBorder
      ? 'bg-gray-100 text-gray-400 border-gray-200'
      : 'bg-gray-100 text-gray-400';
  }
  if (tier === 'low') {
    return withBorder
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-green-100 text-green-700';
  }
  if (tier === 'mid') {
    return withBorder
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-yellow-100 text-yellow-700';
  }
  return withBorder
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-red-100 text-red-700';
}
