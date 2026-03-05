import { levelIndex } from './levelUtils';
export { levelIndex };

function teamLevelSum(team, players) {
  return team.reduce((sum, id) => {
    const p = players.find(p => p.id === id);
    return sum + (p ? levelIndex(p.level) : 5);
  }, 0);
}

// Try to split 4 players into 2 balanced teams using dynamic rating
function bestTeamSplit(group, players) {
  const [a, b, c, d] = group;
  const combos = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];
  let best = null;
  let bestDiff = Infinity;
  for (const [t1, t2] of combos) {
    const diff = Math.abs(teamLevelSum(t1, players) - teamLevelSum(t2, players));
    if (diff < bestDiff) { bestDiff = diff; best = [t1, t2]; }
  }
  return best;
}

export function buildWarnings(team1, team2, players) {
  const warnings = [];
  for (const team of [team1, team2]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const p = players.find(p => p.id === team[i]);
        if (p && p.partnerHistory[team[j]] > 0) {
          const partner = players.find(pl => pl.id === team[j]);
          warnings.push(`${p.name} 和 ${partner?.name} 已是隊友 ${p.partnerHistory[team[j]]} 次`);
        }
      }
    }
  }
  for (const pid of team1) {
    for (const oid of team2) {
      const p = players.find(p => p.id === pid);
      if (p && p.opponentHistory[oid] > 0) {
        const opp = players.find(pl => pl.id === oid);
        warnings.push(`${p.name} 和 ${opp?.name} 已對戰 ${p.opponentHistory[oid]} 次`);
      }
    }
  }
  return warnings;
}

// Priority sort: waitCount >= 3 gets 10x weight
function prioritySort(ids, players) {
  return [...ids].sort((a, b) => {
    const pa = players.find(p => p.id === a);
    const pb = players.find(p => p.id === b);
    if (!pa || !pb) return 0;
    const wa = pa.waitCount >= 3 ? pa.waitCount * 10 : pa.waitCount;
    const wb = pb.waitCount >= 3 ? pb.waitCount * 10 : pb.waitCount;
    if (wb !== wa) return wb - wa;
    return pa.gamesPlayed - pb.gamesPlayed;
  });
}

export function generateSuggestions(state) {
  const { players, courts, waitingQueue, settings } = state;
  const suggestions = [];

  const emptyCourts = courts.filter(c => !c.currentGame);
  if (emptyCourts.length === 0) return suggestions;

  const eligible = waitingQueue.filter(id => players.find(p => p.id === id));
  if (eligible.length < 4) return suggestions;

  const assigned = new Set();
  const MAX_GAP = 8;

  for (const court of emptyCourts) {
    const available = eligible.filter(id => !assigned.has(id));
    if (available.length < 4) break;

    const sorted = prioritySort(available, players);
    const candidates = sorted.slice(0, Math.min(sorted.length, 16));

    let selectedGroup = null;
    let actualGapUsed = settings.levelGapLimit;

    // Soft constraint: progressively relax gap limit until a group is found
    for (let gapLimit = settings.levelGapLimit; gapLimit <= MAX_GAP; gapLimit++) {
      // i is limited to top 4 candidates to always include a high-priority player
      outerLoop: for (let i = 0; i < Math.min(candidates.length - 3, 4); i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          for (let k = j + 1; k < candidates.length; k++) {
            for (let l = k + 1; l < candidates.length; l++) {
              const group = [candidates[i], candidates[j], candidates[k], candidates[l]];
              const levels = group.map(id => levelIndex(players.find(p => p.id === id)?.level ?? '5'));
              const gap = Math.max(...levels) - Math.min(...levels);
              if (gap <= gapLimit) {
                selectedGroup = group;
                actualGapUsed = gapLimit;
                break outerLoop;
              }
            }
          }
        }
      }
      if (selectedGroup) break;
    }

    // Absolute fallback: take top 4 regardless of level
    if (!selectedGroup) {
      selectedGroup = sorted.slice(0, 4);
      actualGapUsed = MAX_GAP;
    }

    const [team1, team2] = bestTeamSplit(selectedGroup, players);
    const warnings = buildWarnings(team1, team2, players);

    // Warn if level gap exceeded the original setting
    const levels = selectedGroup.map(id => levelIndex(players.find(p => p.id === id)?.level ?? '5'));
    const actualGap = Math.max(...levels) - Math.min(...levels);
    if (actualGap > settings.levelGapLimit) {
      warnings.unshift(`此組合等級差距較大（差 ${actualGap} 級）`);
    }

    suggestions.push({ courtId: court.id, courtName: court.name, team1, team2, warnings });
    selectedGroup.forEach(id => assigned.add(id));
  }

  return suggestions;
}

// Find eligible substitutes for a player, sorted by priority
function findEligibleSubstitutes(suggestions, playerId, state) {
  const { players, waitingQueue, courts } = state;
  const inSuggestions = new Set(
    suggestions.flatMap(s => [...s.team1, ...s.team2]).filter(id => id && id !== playerId)
  );
  const inGames = new Set(
    courts.flatMap(c => c.currentGame
      ? [...c.currentGame.team1, ...c.currentGame.team2].filter(Boolean)
      : []
    )
  );
  const eligible = waitingQueue.filter(id =>
    id !== playerId && !inSuggestions.has(id) && !inGames.has(id)
  );
  return prioritySort(eligible, players);
}

// Get top N substitute candidate IDs for a player
export function getSubstituteCandidates(suggestions, playerId, state, count = 3) {
  return findEligibleSubstitutes(suggestions, playerId, state).slice(0, count);
}

// Replace a player in a suggestion; if substituteId is given use it, otherwise auto-pick best
export function substitutePlayerInSuggestion(suggestions, courtId, playerId, state, substituteId = null) {
  const { players } = state;
  const substitute = substituteId ?? findEligibleSubstitutes(suggestions, playerId, state)[0] ?? null;

  return suggestions.map(s => {
    if (s.courtId !== courtId) return s;
    const newTeam1 = s.team1.map(id => id === playerId ? substitute : id);
    const newTeam2 = s.team2.map(id => id === playerId ? substitute : id);
    const warnings = buildWarnings(
      newTeam1.filter(Boolean), newTeam2.filter(Boolean), players
    );
    const allLevels = [...newTeam1, ...newTeam2].filter(Boolean)
      .map(id => levelIndex(players.find(p => p.id === id)?.level ?? '5'));
    if (allLevels.length === 4) {
      const gap = Math.max(...allLevels) - Math.min(...allLevels);
      if (gap > state.settings.levelGapLimit) {
        warnings.unshift(`此組合等級差距較大（差 ${gap} 級）`);
      }
    }
    return { ...s, team1: newTeam1, team2: newTeam2, warnings };
  });
}
