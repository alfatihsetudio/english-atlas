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
  { tier: 'Rookie', minPoints: 0, maxPoints: 200, winPoints: 20, losePoints: 0 },
  { tier: 'Elementary', minPoints: 201, maxPoints: 500, winPoints: 10, losePoints: 0 },
  { tier: 'Intermediate', minPoints: 501, maxPoints: 1000, winPoints: 10, losePoints: -5 },
  { tier: 'Advanced', minPoints: 1001, maxPoints: 2000, winPoints: 4, losePoints: -2 },
  { tier: 'Immortal', minPoints: 2001, maxPoints: Infinity, winPoints: 1, losePoints: -2 },
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

export function calculateBattlePoints(currentPoints: number, isWinner: boolean, isDraw: boolean = false): number {
  const rankInfo = getRankInfo(currentPoints);
  
  if (isDraw) {
    // Jika seri, berikan sedikit poin hiburan atau 0
    return Math.max(0, currentPoints + 2);
  }
  
  // Di Battle Mode, taruhannya lebih tinggi. Menang dapat 2x lipat, kalah juga bisa minus lebih banyak.
  const pointsChange = isWinner ? (rankInfo.winPoints * 2) : (rankInfo.losePoints * 2);
  const newPoints = currentPoints + pointsChange;
  
  // Poin tidak boleh turun di bawah 0
  return Math.max(0, newPoints);
}
