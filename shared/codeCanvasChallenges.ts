// Code Canvas Challenge Definitions

export interface CodeCanvasChallenge {
  id: number;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  targetPattern: [number, number][];
  hint: string;
  starterCode: string;
  maxTime?: number; // seconds
  points: number;
}

export const CODE_CANVAS_CHALLENGES: CodeCanvasChallenge[] = [
  // Level 1: Simple Horizontal Line
  {
    id: 1,
    title: "Horizontal Line",
    description: "Draw a horizontal line across row 5",
    difficulty: 'easy',
    targetPattern: [
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], 
      [5, 5], [6, 5], [7, 5], [8, 5], [9, 5]
    ],
    hint: "Use a for loop from 0 to 9 and keep y constant at 5",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Loop through x from 0 to 9, y stays at 5
  // Push [x, 5] to coordinates array
  
  return coordinates;
}`,
    maxTime: 120,
    points: 10
  },

  // Level 2: Vertical Line
  {
    id: 2,
    title: "Vertical Line",
    description: "Draw a vertical line down column 4",
    difficulty: 'easy',
    targetPattern: [
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
      [4, 5], [4, 6], [4, 7], [4, 8], [4, 9]
    ],
    hint: "Keep x constant at 4, loop y from 0 to 9",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: x stays at 4, loop y from 0 to 9
  
  return coordinates;
}`,
    maxTime: 120,
    points: 10
  },

  // Level 3: Diagonal Line
  {
    id: 3,
    title: "Diagonal Line",
    description: "Draw a diagonal line from top-left to bottom-right",
    difficulty: 'easy',
    targetPattern: [
      [0, 0], [1, 1], [2, 2], [3, 3], [4, 4],
      [5, 5], [6, 6], [7, 7], [8, 8], [9, 9]
    ],
    hint: "In a diagonal, x and y are always equal: [i, i]",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Loop i from 0 to 9, push [i, i]
  
  return coordinates;
}`,
    maxTime: 120,
    points: 15
  },

  // Level 4: Square Outline
  {
    id: 4,
    title: "Square Outline",
    description: "Draw a 6x6 square outline with corners at (2,2) and (7,7)",
    difficulty: 'medium',
    targetPattern: [
      // Top edge
      [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
      // Bottom edge
      [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
      // Left edge (excluding corners already drawn)
      [2, 3], [2, 4], [2, 5], [2, 6],
      // Right edge (excluding corners already drawn)
      [7, 3], [7, 4], [7, 5], [7, 6]
    ],
    hint: "Draw 4 lines: top (y=2), bottom (y=7), left (x=2), right (x=7)",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Draw 4 edges of the square
  // Top and bottom: x from 2 to 7
  // Left and right: y from 3 to 6 (avoid corner duplicates)
  
  return coordinates;
}`,
    maxTime: 180,
    points: 20
  },

  // Level 5: Checkerboard Pattern
  {
    id: 5,
    title: "Checkerboard",
    description: "Create a checkerboard pattern (fill cells where x+y is even)",
    difficulty: 'medium',
    targetPattern: (() => {
      const pattern: [number, number][] = [];
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          if ((x + y) % 2 === 0) {
            pattern.push([x, y]);
          }
        }
      }
      return pattern;
    })(),
    hint: "Use modulo operator %. If (x + y) % 2 === 0, add the cell",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Nested loops for x and y from 0 to 9
  // If (x + y) is even, push [x, y]
  
  return coordinates;
}`,
    maxTime: 180,
    points: 25
  },

  // Level 6: Cross Pattern
  {
    id: 6,
    title: "Cross/Plus Sign",
    description: "Draw a plus sign (+) at the center of the grid",
    difficulty: 'medium',
    targetPattern: [
      // Horizontal line at y=4
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4],
      // Vertical line at x=4 (excluding center already drawn)
      [4, 0], [4, 1], [4, 2], [4, 3], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9]
    ],
    hint: "Draw two lines: horizontal at y=4 and vertical at x=4",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Draw horizontal and vertical lines through center
  
  return coordinates;
}`,
    maxTime: 150,
    points: 20
  },

  // Level 7: Hollow Square
  {
    id: 7,
    title: "Border Only",
    description: "Fill only the edges of the entire 10x10 grid",
    difficulty: 'medium',
    targetPattern: (() => {
      const pattern: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        pattern.push([i, 0]); // Top edge
        pattern.push([i, 9]); // Bottom edge
        pattern.push([0, i]); // Left edge
        pattern.push([9, i]); // Right edge
      }
      return pattern;
    })(),
    hint: "Draw cells where x=0, x=9, y=0, or y=9",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Add all border cells
  
  return coordinates;
}`,
    maxTime: 180,
    points: 25
  },

  // Level 8: Triangle
  {
    id: 8,
    title: "Right Triangle",
    description: "Draw a right triangle in the bottom-left corner",
    difficulty: 'hard',
    targetPattern: (() => {
      const pattern: [number, number][] = [];
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col <= row; col++) {
          pattern.push([col, 9 - row]);
        }
      }
      return pattern;
    })(),
    hint: "For each row from bottom, fill cells from left equal to row number",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Nested loops - outer for rows, inner for columns
  // Bottom row (y=9): 1 cell, next row (y=8): 2 cells, etc.
  
  return coordinates;
}`,
    maxTime: 240,
    points: 30
  },

  // Level 9: Diamond
  {
    id: 9,
    title: "Diamond Shape",
    description: "Create a diamond pattern centered in the grid",
    difficulty: 'hard',
    targetPattern: (() => {
      const pattern: [number, number][] = [];
      const center = 4.5;
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          const dist = Math.abs(x - center) + Math.abs(y - center);
          if (dist <= 4) {
            pattern.push([x, y]);
          }
        }
      }
      return pattern;
    })(),
    hint: "Use Manhattan distance: |x - 4.5| + |y - 4.5| <= 4",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Calculate distance from center for each cell
  // If distance <= 4, include it
  
  return coordinates;
}`,
    maxTime: 300,
    points: 40
  },

  // Level 10: Spiral
  {
    id: 10,
    title: "Spiral Pattern",
    description: "Draw an outward spiral starting from the center",
    difficulty: 'hard',
    targetPattern: [
      [4,4], [5,4], [5,5], [4,5], [3,5], [3,4], [3,3], [4,3], [5,3],
      [6,3], [6,4], [6,5], [6,6], [5,6], [4,6], [3,6], [2,6], [2,5],
      [2,4], [2,3], [2,2], [3,2], [4,2], [5,2], [6,2], [7,2], [7,3],
      [7,4], [7,5], [7,6], [7,7], [6,7], [5,7], [4,7], [3,7], [2,7],
      [1,7], [1,6], [1,5], [1,4], [1,3], [1,2], [1,1], [2,1], [3,1],
      [4,1], [5,1], [6,1], [7,1], [8,1], [8,2], [8,3], [8,4], [8,5],
      [8,6], [8,7], [8,8]
    ],
    hint: "Start at center, move right, then spiral clockwise. Track direction changes.",
    starterCode: `function generatePattern() {
  const coordinates = [];
  
  // TODO: Implement spiral algorithm
  // Start at (4,4), move in spiral: right, down, left, up, repeat
  // Increase steps after each complete cycle
  
  return coordinates;
}`,
    maxTime: 360,
    points: 50
  }
];

/**
 * Get challenge by ID
 */
export function getChallengeById(id: number): CodeCanvasChallenge | undefined {
  return CODE_CANVAS_CHALLENGES.find(c => c.id === id);
}

/**
 * Get challenges by difficulty
 */
export function getChallengesByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): CodeCanvasChallenge[] {
  return CODE_CANVAS_CHALLENGES.filter(c => c.difficulty === difficulty);
}
