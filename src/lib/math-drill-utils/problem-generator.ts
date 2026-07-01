import { type MathDrillConfig, type MathProblem, type MathDrillDifficulty, DIFFICULTY_RANGES, DIFFICULTY_QUESTION_LIMITS, DIVISION_MAX_ANSWER, MAX_OPERANDS } from './types';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateProblems(config: MathDrillConfig): MathProblem[] {
  const { difficulty, operations, numberOfQuestions, columns, 
    includeBorrowing, includeCarrying, includeRemainders, timesTableNumber,
  } = config;

  const range = DIFFICULTY_RANGES[difficulty];
  const probCount = Math.max(1, Math.min(numberOfQuestions, DIFFICULTY_QUESTION_LIMITS[difficulty].max));
  const problems: MathProblem[] = [];

  const needSubtraction = operations.includes('-');
  const needAddition = operations.includes('+') ;
  const needMultiplication = operations.includes('×');
  const needDivision = operations.includes('÷');

  // Generate base pools of numbers for each operation
  const numPool: number[] = [];
  for (let i = range.min; i <= range.max; i++) {
    numPool.push(i);
  }

  // --- Helper: generate division with remainder control ---
  const makeDivision = (): MathProblem => {
    const maxAnswer = DIVISION_MAX_ANSWER[difficulty];
    const maxDivisor = Math.max(2, Math.min(12, Math.floor(maxAnswer / 2)));
    let divisor = Math.floor(Math.random() * maxDivisor) + 2;
    let answer = Math.floor(Math.random() * maxAnswer) + 1;
    if (!includeRemainders) {
      answer *= divisor;
    }
    let dividend = answer * divisor;

    if (includeBorrowing) {
      const maxDigits = String(dividend).length;
      const minDigits = Math.max(2, Math.floor(maxDigits * 0.6));
      if (minDigits < maxDigits) {
        const minDivisor = Math.max(2, Math.floor(maxDivisor * 0.7));
        const divisorMax = Math.min(maxDivisor, Math.floor(dividend / (minDivisor * 10)));
        if (divisorMax >= minDivisor) {
          const dividendMax = minDivisor * divisorMax;
          const modifiedDividend = Math.floor(Math.random() * (dividendMax - (range.min * divisor)) + range.min * divisor);
          const modifiedDivisor = Math.floor(Math.random() * (divisorMax - minDivisor + 1)) + minDivisor;
          const modifiedAnswer = Math.floor(modifiedDividend / modifiedDivisor);
          if (modifiedDividend % modifiedDivisor === 0 && modifiedAnswer >= 2) {
            dividend = modifiedDividend;
            divisor = modifiedDivisor;
            answer = modifiedAnswer;
          }
        }
      }
    }

    return {
      id: problems.length + 1,
      operand1: dividend,
      operand2: divisor,
      operator: '÷',
      answer,
    };
  };

  // --- Pre-generate all possible valid problems ---
  const possible: MathProblem[] = [];

  if (needAddition) {
    for (const n1 of numPool) {
      for (const n2 of numPool) {
        if (!includeCarrying) {
          const s = n1 + n2;
          if (s < 10) {
            possible.push({
              id: possible.length + 1,
              operand1: n1,
              operand2: n2,
              operator: '+',
              answer: s,
            });
          }
        } else {
          const max = Math.min(n1 + n2, 19);
          for (let sum = Math.max(10, n1 + n2 - 9); sum <= max; sum++) {
            possible.push({
              id: possible.length + 1,
              operand1: n1,
              operand2: sum - n1,
              operator: '+',
              answer: sum,
            });
          }
        }
      }
    }
    possible.sort(() => 0.5 - Math.random());
  }

  if (needSubtraction) {
    for (const n1 of numPool) {
      for (const n2 of numPool) {
        if (n1 >= n2) {
          let result = n1 - n2;
          if (!includeBorrowing) {
            const tens1 = Math.floor(n1 / 10), ones1 = n1 % 10;
            const tens2 = Math.floor(n2 / 10), ones2 = n2 % 10;
            if (ones1 < ones2 || (ones1 === ones2 && tens1 < tens2)) {
              continue;
            }
            if (tens1 === tens2 && ones1 === ones2) continue;
          }
          possible.push({
            id: possible.length + 1,
            operand1: n1,
            operand2: n2,
            operator: '-',
            answer: result,
          });
        }
      }
    }
    possible.sort(() => 0.5 - Math.random());
  }

  if (needMultiplication) {
    for (const n1 of numPool) {
      for (const n2 of numPool) {
        const product = n1 * n2;
        const maxProd = Math.min(MAX_OPERANDS[difficulty].multiplication, 999);
        if (product <= maxProd) {
          possible.push({
            id: possible.length + 1,
            operand1: n1,
            operand2: n2,
            operator: '×',
            answer: product,
          });
        }
      }
    }
    possible.sort(() => 0.5 - Math.random());
  }

  if (needDivision) {
    for (let dividend = range.min; dividend <= range.max; dividend++) {
      for (let divisor = 2; divisor <= MAX_OPERANDS[difficulty].division; divisor++) {
        if (dividend % divisor === 0) {
          const answer = dividend / divisor;
          if (!includeRemainders && dividend % divisor !== 0) continue;
          possible.push({
            id: possible.length + 1,
            operand1: dividend,
            operand2: divisor,
            operator: '÷',
            answer,
          });
        }
      }
    }

    if (needSubtraction) {
      const subtractionPool = possible.filter(p => p.operator === '-');
      for (const sub of subtractionPool) {
        if (sub.operand1 >= 2 * sub.operand2 && sub.operand1 % sub.operand2 === 0) {
          possible.push({
            id: possible.length + 1,
            operand1: sub.operand1,
            operand2: sub.operand2,
            operator: '÷',
            answer: sub.operand1 / sub.operand2,
          });
        }
      }
    }

    possible.sort(() => 0.5 - Math.random());
  }

  // --- Times table template special handling ---
  if (config.templateId === 'times-table-drill') {
    const selected = timesTableNumber;
    const rows: string[] = [];

    for (let i = 1; i <= 12; i++) {
      const value = selected * i;
      const optionType = Math.random() < 0.5 ? 'secondOperand' : 'result';

      if (optionType === 'secondOperand') {
        possible.push({
          id: possible.length + 1,
          operand1: selected,
          operand2: i,
          operator: '×',
          answer: value,
        });
      } else {
        possible.push({
          id: possible.length + 1,
          operand1: value,
          operand2: selected,
          operator: '÷',
          answer: i,
        });
      }
    }
  }

  // --- Shuffle the entire pool and pick problemCount from it ---
  const shuffled = shuffleArray(possible);

  if (shuffled.length === 0) {
    // Fallback: create safe small problems
    for (let i = 1; i <= Math.min(5, probCount); i++) {
      problems.push({
        id: i,
        operand1: i,
        operand2: i % 2 === 0 ? i / 2 : (i + 1) % 2 === 0 ? Math.max(1, i - 1) : 1,
        operator: needAddition ? '+' : needSubtraction ? '-' : needMultiplication ? '×' : needDivision ? '÷' : '+',
        answer: needAddition ? i + 1 : needSubtraction ? Math.max(0, i - 1) : needMultiplication ? i * 2 : needDivision ? 2 : i,
      });
    }
  }

  const selectedProblems = shuffled.slice(0, probCount);

  return selectedProblems.map((p, index) => ({ ...p, id: index + 1 }));
}

// Helper validation functions
function validateProblemConstraints(problem: MathProblem, difficulty: MathDrillDifficulty): boolean {
  const { operand1, operand2, operator, answer } = problem;

  switch (operator) {
    case '+':
      return operand1 + operand2 === answer && operand1 >= DIFFICULTY_RANGES[difficulty].min && operand1 <= DIFFICULTY_RANGES[difficulty].max && operand2 >= 0 && operand2 <= DIFFICULTY_RANGES[difficulty].max;
    case '-':
      return operand1 - operand2 === answer && operand1 >= operand2 && operand1 >= DIFFICULTY_RANGES[difficulty].min && operand1 <= DIFFICULTY_RANGES[difficulty].max && operand2 >= 0 && operand2 <= DIFFICULTY_RANGES[difficulty].max;
    case '×':
      return operand1 * operand2 === answer && operand1 >= DIFFICULTY_RANGES[difficulty].min && operand1 <= DIFFICULTY_RANGES[difficulty].max && operand2 >= 2 && operand2 <= DIFFICULTY_RANGES[difficulty].max && answer <= 1000;
    case '÷':
      if (operand2 === 0) return false;
      return operand1 / operand2 === answer && operand1 >= DIFFICULTY_RANGES[difficulty].min && operand1 <= DIFFICULTY_RANGES[difficulty].max && operand2 >= 2 && operand2 <= 12 && answer >= 1 && answer <= 100;
    default:
      return false;
  }
}

function deduplicateProblems(problems: MathProblem[]): MathProblem[] {
  const uniqueMap = new Map<string, MathProblem>();
  for (const p of problems) {
    const key = `${p.operator}|${p.operand1}|${p.operand2}|${p.answer}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, p);
  }
  return Array.from(uniqueMap.values());
}

function generateSpacedProblems(config: MathDrillConfig): MathProblem[] {
  const problems = generateProblems(config);
  const spaced: MathProblem[] = [];

  for (const p of problems) {
    let attempts = 0;
    let spacedProblem: MathProblem | null = null;
    while (attempts < 100 && !spacedProblem) {
      const space1 = Math.floor(Math.random() * 10);
      const space2 = Math.floor(Math.random() * 10);
      let op1 = p.operand1;
      let op2 = p.operand2;
      let answer = p.answer;
      let operator = p.operator;

      switch (operator) {
        case '+':
          op1 = Math.max(0, p.operand1 - space1);
          op2 = p.operand2 + space2;
          answer = op1 + op2;
          break;
        case '-':
          op1 = p.operand1 + space1;
          op2 = Math.max(0, p.operand2 - space2);
          answer = op1 - op2;
          break;
        case '×':
          op1 = Math.max(1, p.operand1 - space1);
          op2 = Math.max(2, p.operand2 + space2);
          answer = op1 * op2;
          break;
        case '÷':
          op2 = Math.max(2, p.operand2 - space1);
          op1 = answer * op2 + space2;
          break;
      }

      const testProblem: MathProblem = { id: 0, operand1: op1, operand2: op2, operator, answer };
      if (validateProblemConstraints(testProblem, config.difficulty)) {
        spacedProblem = testProblem;
      }
      attempts++;
    }
    if (spacedProblem) {
      spaced.push(spacedProblem);
    } else {
      spaced.push(p);
    }
  }

  return spaced;
}

export { shuffleArray, validateProblemConstraints, deduplicateProblems, generateSpacedProblems };