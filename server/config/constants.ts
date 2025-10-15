// server/config/constants.ts
export const GRID_POSITIONS = (() => {
  const letters = ["A", "B", "C", "D", "E"];
  const positions: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 1; c <= 5; c++) {
      positions.push(`${letters[r]}${c}`);
    }
  }
  return positions;
})();

export const DEFAULT_TIMER_MINUTES = 30;
export const WINNING_LINES = 5;