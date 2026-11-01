// ─── Shared Maths Utilities ──────────────────────────────────────────────────
// Ported verbatim from the legacy frontend/lib/maths-utils.ts.
// Pure logic only: no network, no React.

export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type TableNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export const TABLE_NUMBERS: TableNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export type MasteryStage = 'learn' | 'practice' | 'prove';
export const MASTERY_STAGES: { key: MasteryStage; label: string; icon: string }[] = [
  { key: 'learn', label: 'Learn', icon: '📖' },
  { key: 'practice', label: 'Practice', icon: '🎯' },
  { key: 'prove', label: 'Prove', icon: '⚡' },
];

export const MILESTONES = [
  { name: 'Bronze', tables: [1, 2, 3, 4] as TableNumber[], emoji: '⭐' },
  { name: 'Silver', tables: [5, 6, 7, 8] as TableNumber[], emoji: '🥈' },
  { name: 'Gold', tables: [9, 10, 11, 12] as TableNumber[], emoji: '🥇' },
] as const;

export interface Problem {
  a: number;
  b: number;
  operation: Operation;
  answer: number;
  emoji: string;
  choices: number[];
}

export interface MixedProblem extends Problem {
  tableUsed: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const EMOJI_OBJECTS = [
  'star',
  'apple',
  'heart',
  'flower',
  'butterfly',
  'fish',
  'cookie',
  'balloon',
];
export const EMOJI_MAP: Record<string, string> = {
  star: '⭐',
  apple: '🍎',
  heart: '❤️',
  flower: '🌻',
  butterfly: '🦋',
  fish: '🐟',
  cookie: '🍪',
  balloon: '🎈',
};

export const DIFFICULTY_RANGES: Record<
  Difficulty,
  { add: [number, number]; mul: [number, number]; mulMax: number }
> = {
  easy: { add: [1, 5], mul: [1, 3], mulMax: 9 },
  medium: { add: [3, 10], mul: [2, 5], mulMax: 25 },
  hard: { add: [5, 20], mul: [3, 10], mulMax: 100 },
};

export const OPERATION_LABELS: Record<Operation, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
};

export const OPERATION_SYMBOLS: Record<Operation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function comboKey(op: Operation, diff: Difficulty): string {
  return `${op}-${diff}`;
}

// ─── Tiered emoji sizing ─────────────────────────────────────────────────────

export function emojiSizeClass(count: number): string {
  if (count <= 12) return 'text-xl sm:text-2xl';
  if (count <= 25) return 'text-base sm:text-lg';
  return 'text-sm';
}

// ─── Problem Generation ──────────────────────────────────────────────────────

export function generateProblem(operation: Operation, difficulty: Difficulty): Problem {
  const range = DIFFICULTY_RANGES[difficulty];
  const emojiKey = pickRandom(EMOJI_OBJECTS);
  let a: number, b: number, answer: number;

  switch (operation) {
    case 'addition': {
      a = randInt(range.add[0], range.add[1]);
      b = randInt(range.add[0], range.add[1]);
      answer = a + b;
      break;
    }
    case 'subtraction': {
      a = randInt(range.add[0], range.add[1]);
      b = randInt(range.add[0], range.add[1]);
      if (b > a) [a, b] = [b, a];
      answer = a - b;
      break;
    }
    case 'multiplication': {
      a = randInt(range.mul[0], range.mul[1]);
      b = randInt(range.mul[0], range.mul[1]);
      if (a * b > range.mulMax) {
        a = Math.min(a, Math.floor(range.mulMax / Math.max(b, 1)));
        if (a < range.mul[0]) a = range.mul[0];
      }
      answer = a * b;
      break;
    }
    case 'division': {
      const divisor = randInt(range.mul[0], range.mul[1]);
      const quotient = randInt(range.mul[0], range.mul[1]);
      let dividend = divisor * quotient;
      if (dividend > range.mulMax) {
        const cappedQuotient = Math.max(
          range.mul[0],
          Math.floor(range.mulMax / Math.max(divisor, 1)),
        );
        dividend = divisor * cappedQuotient;
        a = dividend;
        b = divisor;
        answer = cappedQuotient;
      } else {
        a = dividend;
        b = divisor;
        answer = quotient;
      }
      break;
    }
  }

  const choiceSet = new Set<number>([answer]);
  while (choiceSet.size < 4) {
    const offset = randInt(1, Math.max(3, Math.ceil(answer * 0.5) || 3));
    const candidate = Math.random() > 0.5 ? answer + offset : Math.max(0, answer - offset);
    choiceSet.add(candidate);
  }
  const choices = Array.from(choiceSet).sort(() => Math.random() - 0.5);

  return { a, b, operation, answer, emoji: emojiKey, choices };
}

// ─── Table-specific Problem Generation ──────────────────────────────────────

export function generateTableProblem(operation: Operation, tableNumber: number): Problem {
  const emojiKey = pickRandom(EMOJI_OBJECTS);
  let a: number, b: number, answer: number;

  const other = randInt(1, 12);

  switch (operation) {
    case 'addition': {
      a = tableNumber;
      b = other;
      answer = a + b;
      break;
    }
    case 'subtraction': {
      a = tableNumber + other;
      b = tableNumber;
      answer = a - b;
      break;
    }
    case 'multiplication': {
      a = tableNumber;
      b = other;
      answer = a * b;
      break;
    }
    case 'division': {
      a = tableNumber * other;
      b = tableNumber;
      answer = other;
      break;
    }
  }

  const choiceSet = new Set<number>([answer]);
  while (choiceSet.size < 4) {
    const offset = randInt(1, Math.max(3, Math.ceil(answer * 0.5) || 3));
    const candidate = Math.random() > 0.5 ? answer + offset : Math.max(0, answer - offset);
    choiceSet.add(candidate);
  }
  const choices = Array.from(choiceSet).sort(() => Math.random() - 0.5);

  return { a, b, operation, answer, emoji: emojiKey, choices };
}

export function generateMixedProblem(
  operation: Operation,
  currentTable: number,
  weightedTable: number,
): MixedProblem {
  const useCurrentTable = Math.random() < 0.5;
  const tableUsed = useCurrentTable ? weightedTable : randInt(1, currentTable);
  const problem = generateTableProblem(operation, tableUsed);
  return { ...problem, tableUsed };
}

export function tableProgressKey(op: Operation, tableNumber: number): string {
  return `${op}-${tableNumber}`;
}

// ─── Operation-specific table labels ─────────────────────────────────────────

/** Short label for circle badges: "+1", "−3", "5×", "÷7" */
export function getTableBadge(operation: Operation, tableNumber: number): string {
  switch (operation) {
    case 'addition':
      return `+${tableNumber}`;
    case 'subtraction':
      return `−${tableNumber}`;
    case 'multiplication':
      return `${tableNumber}×`;
    case 'division':
      return `÷${tableNumber}`;
  }
}

/** Full label for headers: "Adding 1s", "Subtracting 3s", "5× Table", "Dividing by 7" */
export function getTableLabel(operation: Operation, tableNumber: number): string {
  switch (operation) {
    case 'addition':
      return `Adding ${tableNumber}s`;
    case 'subtraction':
      return `Subtracting ${tableNumber}s`;
    case 'multiplication':
      return `${tableNumber}× Table`;
    case 'division':
      return `Dividing by ${tableNumber}`;
  }
}
