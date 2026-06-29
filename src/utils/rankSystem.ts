export type RankTier =
  | 'Rookie'
  | 'Elementary'
  | 'Intermediate'
  | 'Advanced'
  | 'Immortal';

export interface RankInfo {
  tier: RankTier;
  minPoints: number;
  maxPoints: number;
  winPoints: number;
  losePoints: number;
}

export const RANKS: RankInfo[] = [
  { tier: 'Rookie', minPoints: 0, maxPoints: 500, winPoints: 10, losePoints: 0 },
  { tier: 'Elementary', minPoints: 501, maxPoints: 2000, winPoints: 10, losePoints: -5 },
  { tier: 'Intermediate', minPoints: 2001, maxPoints: 4000, winPoints: 10, losePoints: -10 },
  { tier: 'Advanced', minPoints: 4001, maxPoints: 7000, winPoints: 10, losePoints: -20 },
  { tier: 'Immortal', minPoints: 7001, maxPoints: Infinity, winPoints: 10, losePoints: -40 },
];

export function getRankInfo(points: number): RankInfo {
  // Pastikan point tidak negatif untuk pencarian rank dasar
  const safePoints = Math.max(0, points);
  
  for (const rank of RANKS) {
    if (safePoints >= rank.minPoints && safePoints <= rank.maxPoints) {
      return rank;
    }
  }
  
  // Fallback ke rank tertinggi jika melebihi semua batas
  return RANKS[RANKS.length - 1];
}

export function calculateNewPoints(currentPoints: number, isCorrect: boolean): number {
  const rankInfo = getRankInfo(currentPoints);
  
  const pointsChange = isCorrect ? rankInfo.winPoints : rankInfo.losePoints;
  const newPoints = currentPoints + pointsChange;
  
  // Poin tidak boleh turun di bawah 0
  return Math.max(0, newPoints);
}

