'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator as CalcIcon,
  Minus,
  X,
  ChevronDown,
  ChevronUp,
  Atom,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalculatorProps {
  mode?: 'basic' | 'scientific';
  allowedMode?: 'basic' | 'scientific' | 'both';
  isOpen?: boolean;
  onToggle?: () => void;
}

type CalcMode = 'basic' | 'scientific';

// ─── Safe Math Evaluator ─────────────────────────────────────────────────────
// Recursive descent parser — no eval() or Function()

type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'function'; value: string }
  | { type: 'comma' }
  | { type: 'constant'; value: number };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9' || ch === '.') {
      let num = '';
      while (i < expr.length && (expr[i] >= '0' && expr[i] <= '9' || expr[i] === '.')) {
        num += expr[i];
        i++;
      }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) throw new Error('Invalid number');
      tokens.push({ type: 'number', value: parsed });
    } else if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
    } else if (ch === ',') {
      tokens.push({ type: 'comma' });
      i++;
    } else if (ch === 'π') {
      tokens.push({ type: 'constant', value: Math.PI });
      i++;
    } else if (ch === 'e' && (i + 1 >= expr.length || !/[a-z]/i.test(expr[i + 1]))) {
      tokens.push({ type: 'constant', value: Math.E });
      i++;
    } else if (/[a-z]/i.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-z]/i.test(expr[i])) {
        name += expr[i];
        i++;
      }
      const fn = name.toLowerCase();
      const known = [
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
        'log', 'ln', 'sqrt', 'cbrt', 'abs', 'fact',
        'exp', 'pow',
      ];
      if (known.includes(fn)) {
        tokens.push({ type: 'function', value: fn });
      } else if (fn === 'pi') {
        tokens.push({ type: 'constant', value: Math.PI });
      } else {
        throw new Error(`Unknown function: ${name}`);
      }
    } else if ('+-×÷*/%^'.includes(ch)) {
      let op = ch;
      if (ch === '×') op = '*';
      if (ch === '÷') op = '/';
      if (ch === '^') op = '**';
      tokens.push({ type: 'operator', value: op });
      i++;
    } else {
      throw new Error(`Unexpected character: ${ch}`);
    }
  }
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos: number;
  private degrees: boolean;

  constructor(tokens: Token[], degrees: boolean) {
    this.tokens = tokens;
    this.pos = 0;
    this.degrees = degrees;
  }

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private toRad(deg: number): number {
    return this.degrees ? (deg * Math.PI) / 180 : deg;
  }

  private fromRad(rad: number): number {
    return this.degrees ? (rad * 180) / Math.PI : rad;
  }

  private factorial(n: number): number {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    if (n <= 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  private applyFunction(name: string, arg: number): number {
    switch (name) {
      case 'sin': return Math.sin(this.toRad(arg));
      case 'cos': return Math.cos(this.toRad(arg));
      case 'tan': return Math.tan(this.toRad(arg));
      case 'asin': return this.fromRad(Math.asin(arg));
      case 'acos': return this.fromRad(Math.acos(arg));
      case 'atan': return this.fromRad(Math.atan(arg));
      case 'log': return Math.log10(arg);
      case 'ln': return Math.log(arg);
      case 'sqrt': return Math.sqrt(arg);
      case 'cbrt': return Math.cbrt(arg);
      case 'abs': return Math.abs(arg);
      case 'fact': return this.factorial(arg);
      case 'exp': return Math.exp(arg);
      default: return NaN;
    }
  }

  // entry point
  parse(): number {
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected token after expression');
    }
    return result;
  }

  // expression → term (('+' | '-') term)*
  private parseExpression(): number {
    let left = this.parseTerm();
    let next = this.peek();
    while (next?.type === 'operator' && (next.value === '+' || next.value === '-')) {
      const op = (this.consume() as { type: 'operator'; value: string }).value;
      const right = this.parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term → power (('*' | '/') power)*
  private parseTerm(): number {
    let left = this.parsePower();
    let next = this.peek();
    while (next?.type === 'operator' && (next.value === '*' || next.value === '/')) {
      const op = (this.consume() as { type: 'operator'; value: string }).value;
      const right = this.parsePower();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  // power → unary ('**' power)?   (right-associative)
  private parsePower(): number {
    let base = this.parseUnary();
    const next = this.peek();
    if (next?.type === 'operator' && next.value === '**') {
      this.consume();
      const exp = this.parsePower(); // right-recursive for right-associativity
      return Math.pow(base, exp);
    }
    return base;
  }

  // unary → ('-' | '+') unary | postfix
  private parseUnary(): number {
    let next = this.peek();
    if (next?.type === 'operator' && next.value === '-') {
      this.consume();
      return -this.parseUnary();
    }
    next = this.peek();
    if (next?.type === 'operator' && next.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePostfix();
  }

  // postfix → primary ('!')?
  private parsePostfix(): number {
    // check for function call or opening paren followed by expression, then check for factorial
    // Factorial is represented as 'fact(expr)' in our token stream, handled in primary
    return this.parsePrimary();
  }

  // primary → NUMBER | CONSTANT | FUNCTION '(' expression ')' | '(' expression ')'
  private parsePrimary(): number {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');

    if (t.type === 'number') {
      this.consume();
      return t.value;
    }

    if (t.type === 'constant') {
      this.consume();
      return t.value;
    }

    if (t.type === 'function') {
      this.consume();
      const fn = t.value;
      if (this.peek()?.type !== 'lparen') throw new Error(`Expected ( after ${fn}`);
      this.consume(); // consume '('
      const arg = this.parseExpression();
      if (this.peek()?.type !== 'rparen') throw new Error('Expected )');
      this.consume(); // consume ')'
      return this.applyFunction(fn, arg);
    }

    if (t.type === 'lparen') {
      this.consume();
      const expr = this.parseExpression();
      if (this.peek()?.type !== 'rparen') throw new Error('Expected )');
      this.consume();
      return expr;
    }

    // Handle implicit multiplication: if we see a number after a right paren or constant, etc.
    throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
  }
}

function safeEval(expression: string, degrees: boolean): number {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 0;
  const parser = new Parser(tokens, degrees);
  return parser.parse();
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatResult(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return 'Error';
  if (!isFinite(n)) return n > 0 ? 'Infinity' : '-Infinity';
  // Avoid floating point display issues
  const rounded = parseFloat(n.toPrecision(12));
  const str = rounded.toString();
  if (str.length > 16) {
    return rounded.toExponential(8);
  }
  return str;
}

function formatDisplay(n: string): string {
  if (n === 'Error' || n === 'Infinity' || n === '-Infinity') return n;
  // Format the number string for nice display
  const num = parseFloat(n);
  if (isNaN(num)) return n;
  if (n.includes('.') && n.endsWith('.')) return n;
  if (n.includes('e')) return n;
  return n;
}

// ─── Calculator Component ─────────────────────────────────────────────────────

export function Calculator({
  mode: initialMode = 'basic',
  allowedMode = 'both',
  isOpen: controlledIsOpen,
  onToggle,
}: CalculatorProps) {
  // ── Visibility ──
  const [internalOpen, setInternalOpen] = useState(true);
  const isVisible = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const toggleVisibility = useCallback(() => {
    if (onToggle) onToggle();
    else setInternalOpen((v) => !v);
  }, [onToggle]);

  // ── Mode ──
  const canSwitchModes = allowedMode === 'both';
  const [mode, setMode] = useState<CalcMode>(() => {
    if (allowedMode === 'scientific') return 'scientific';
    if (allowedMode === 'basic') return 'basic';
    return initialMode;
  });

  // ── Minimize ──
  const [isMinimized, setIsMinimized] = useState(false);

  // ── Degrees / Radians ──
  const [isDegrees, setIsDegrees] = useState(true);

  // ── Display State ──
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [isResult, setIsResult] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [memory, setMemory] = useState(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [openParens, setOpenParens] = useState(0);

  // ── Position & Drag ──
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // Initialize position to bottom-right
  useEffect(() => {
    if (!isInitialized) {
      const calcWidth = mode === 'scientific' ? 480 : 320;
      const calcHeight = isMinimized ? 40 : 520;
      const newX = Math.max(0, window.innerWidth - calcWidth - 24);
      const newY = Math.max(0, window.innerHeight - calcHeight - 24);
      setPosition({ x: newX, y: newY });
      setIsInitialized(true);
    }
  }, [isInitialized, mode, isMinimized]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: position.x,
        startPosY: position.y,
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const newX = dragRef.current.startPosX + dx;
        const newY = dragRef.current.startPosY + dy;
        // Clamp to viewport
        const clampedX = Math.max(-100, Math.min(window.innerWidth - 100, newX));
        const clampedY = Math.max(0, Math.min(window.innerHeight - 40, newY));
        setPosition({ x: clampedX, y: clampedY });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [position]
  );

  // ── Calculator Logic ──
  const handleDigit = useCallback(
    (digit: string) => {
      if (hasError) {
        setDisplay(digit);
        setExpression('');
        setHasError(false);
        setIsResult(false);
        return;
      }
      if (isResult) {
        setDisplay(digit);
        setExpression('');
        setIsResult(false);
        setOpenParens(0);
      } else {
        if (display === '0' && digit !== '.') {
          setDisplay(digit);
        } else {
          setDisplay((prev) => prev + digit);
        }
      }
    },
    [isResult, hasError, display]
  );

  const handleDecimal = useCallback(() => {
    if (hasError) {
      setDisplay('0.');
      setExpression('');
      setHasError(false);
      setIsResult(false);
      return;
    }
    if (isResult) {
      setDisplay('0.');
      setExpression('');
      setIsResult(false);
      setOpenParens(0);
    } else if (!display.includes('.')) {
      setDisplay((prev) => prev + '.');
    }
  }, [isResult, hasError, display]);

  const handleOperator = useCallback(
    (op: string) => {
      if (hasError) {
        setHasError(false);
      }
      const displayVal = hasError ? '0' : display;
      const newExpr = expression + displayVal + ' ' + op + ' ';
      setExpression(newExpr);
      setDisplay('0');
      setIsResult(false);
    },
    [expression, display, hasError]
  );

  const handleEquals = useCallback(() => {
    try {
      const fullExpr = expression + display;
      if (!fullExpr.trim()) return;

      // Close any open parentheses
      let evalExpr = fullExpr;
      for (let i = 0; i < openParens; i++) {
        evalExpr += ')';
      }

      const result = safeEval(evalExpr, isDegrees);
      const formatted = formatResult(result);

      if (formatted === 'Error') {
        setHasError(true);
        setDisplay('Error');
      } else {
        setDisplay(formatted);
      }
      setExpression(evalExpr + ' =');
      setIsResult(true);
      setOpenParens(0);
    } catch {
      setHasError(true);
      setDisplay('Error');
      setExpression(expression + display + ' =');
      setIsResult(true);
    }
  }, [expression, display, openParens, isDegrees]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setIsResult(false);
    setHasError(false);
    setOpenParens(0);
  }, []);

  const handleClearEntry = useCallback(() => {
    setDisplay('0');
    setHasError(false);
    if (isResult) {
      setExpression('');
      setIsResult(false);
    }
  }, [isResult]);

  const handleBackspace = useCallback(() => {
    if (hasError || isResult) {
      handleClear();
      return;
    }
    if (display.length > 1) {
      setDisplay((prev) => prev.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }, [display, hasError, isResult, handleClear]);

  const handleNegate = useCallback(() => {
    if (hasError || display === '0') return;
    if (display.startsWith('-')) {
      setDisplay((prev) => prev.slice(1));
    } else {
      setDisplay((prev) => '-' + prev);
    }
  }, [display, hasError]);

  const handlePercent = useCallback(() => {
    if (hasError) return;
    const val = parseFloat(display);
    if (isNaN(val)) return;
    const result = val / 100;
    setDisplay(formatResult(result));
    setIsResult(true);
  }, [display, hasError]);

  // ── Scientific Functions ──
  const handleFunction = useCallback(
    (fn: string, displayLabel: string) => {
      if (hasError) {
        setHasError(false);
      }
      // Apply function to current display value
      try {
        const val = parseFloat(display);
        if (isNaN(val)) throw new Error('Invalid');
        const fnExpr = `${fn}(${display})`;
        const result = safeEval(fnExpr, isDegrees);
        const formatted = formatResult(result);
        setExpression(displayLabel + `(${display})`);
        setDisplay(formatted);
        setIsResult(true);
      } catch {
        setDisplay('Error');
        setHasError(true);
      }
    },
    [display, hasError, isDegrees]
  );

  const handlePower = useCallback(
    (power: string, displayLabel: string) => {
      if (hasError) {
        setHasError(false);
      }
      try {
        const val = parseFloat(display);
        if (isNaN(val)) throw new Error('Invalid');
        const result = safeEval(`${display}${power}`, isDegrees);
        const formatted = formatResult(result);
        setExpression(`${display} ${displayLabel}`);
        setDisplay(formatted);
        setIsResult(true);
      } catch {
        setDisplay('Error');
        setHasError(true);
      }
    },
    [display, hasError, isDegrees]
  );

  const handleConstant = useCallback(
    (value: number, label: string) => {
      if (hasError) {
        setHasError(false);
      }
      if (isResult) {
        setExpression('');
        setOpenParens(0);
      }
      setDisplay(value.toString());
      setIsResult(false);
    },
    [hasError, isResult]
  );

  const handleInverse = useCallback(() => {
    if (hasError) return;
    try {
      const val = parseFloat(display);
      if (val === 0) {
        setDisplay('Error');
        setHasError(true);
        return;
      }
      const result = 1 / val;
      const formatted = formatResult(result);
      setExpression(`1/(${display})`);
      setDisplay(formatted);
      setIsResult(true);
    } catch {
      setDisplay('Error');
      setHasError(true);
    }
  }, [display, hasError]);

  const handleFactorial = useCallback(() => {
    if (hasError) return;
    try {
      const val = parseFloat(display);
      if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
        setDisplay('Error');
        setHasError(true);
        return;
      }
      if (val > 170) {
        setDisplay('Infinity');
        setHasError(true);
        return;
      }
      const result = safeEval(`fact(${display})`, isDegrees);
      const formatted = formatResult(result);
      setExpression(`${display}!`);
      setDisplay(formatted);
      setIsResult(true);
    } catch {
      setDisplay('Error');
      setHasError(true);
    }
  }, [display, hasError, isDegrees]);

  const handleParenOpen = useCallback(() => {
    if (hasError) {
      setHasError(false);
      setDisplay('0');
      setExpression('');
    }
    if (isResult) {
      setExpression('');
      setIsResult(false);
    }
    setExpression((prev) => prev + display + ' × (');
    setDisplay('0');
    setOpenParens((prev) => prev + 1);
  }, [display, hasError, isResult]);

  const handleParenClose = useCallback(() => {
    if (openParens <= 0) return;
    try {
      const fullExpr = expression + display + ')';
      const result = safeEval(fullExpr, isDegrees);
      const formatted = formatResult(result);
      setExpression(fullExpr);
      setDisplay(formatted);
      setIsResult(true);
      setOpenParens((prev) => prev - 1);
    } catch {
      setDisplay('Error');
      setHasError(true);
    }
  }, [expression, display, openParens, isDegrees]);

  // ── Power with base: x^y ──
  const handlePowerBase = useCallback(() => {
    if (hasError) {
      setHasError(false);
    }
    const displayVal = hasError ? '0' : display;
    const newExpr = expression + displayVal + '^';
    setExpression(newExpr);
    setDisplay('0');
    setIsResult(false);
  }, [expression, display, hasError]);

  // ── Ten to the X ──
  const handleTenToX = useCallback(() => {
    if (hasError) {
      setHasError(false);
    }
    try {
      const val = parseFloat(display);
      if (isNaN(val)) throw new Error('Invalid');
      const result = Math.pow(10, val);
      const formatted = formatResult(result);
      setExpression(`10^(${display})`);
      setDisplay(formatted);
      setIsResult(true);
    } catch {
      setDisplay('Error');
      setHasError(true);
    }
  }, [display, hasError]);

  // ── E to the X ──
  const handleEToX = useCallback(() => {
    if (hasError) {
      setHasError(false);
    }
    try {
      const val = parseFloat(display);
      if (isNaN(val)) throw new Error('Invalid');
      const result = Math.exp(val);
      const formatted = formatResult(result);
      setExpression(`e^(${display})`);
      setDisplay(formatted);
      setIsResult(true);
    } catch {
      setDisplay('Error');
      setHasError(true);
    }
  }, [display, hasError]);

  // ── Memory ──
  const handleMemoryClear = useCallback(() => {
    setMemory(0);
    setHasMemory(false);
  }, []);

  const handleMemoryRecall = useCallback(() => {
    if (!hasMemory) return;
    setDisplay(memory.toString());
    setIsResult(false);
  }, [memory, hasMemory]);

  const handleMemoryAdd = useCallback(() => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setMemory((prev) => prev + val);
      setHasMemory(true);
    }
  }, [display]);

  const handleMemorySub = useCallback(() => {
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setMemory((prev) => prev - val);
      setHasMemory(true);
    }
  }, [display]);

  // ── Mode Toggle ──
  const handleModeToggle = useCallback(() => {
    if (!canSwitchModes) return;
    setMode((prev) => (prev === 'basic' ? 'scientific' : 'basic'));
  }, [canSwitchModes]);

  if (!isVisible) return null;

  // ── Button helper ──
  const CalcBtn = ({
    label,
    onClick,
    className,
    variant = 'default',
    wide = false,
    title,
  }: {
    label: string;
    onClick: () => void;
    className?: string;
    variant?: 'default' | 'operator' | 'function' | 'memory' | 'danger' | 'equal';
    wide?: boolean;
    title?: string;
  }) => {
    const baseStyles = cn(
      'h-10 text-sm font-medium rounded-md transition-all active:scale-95 select-none',
      wide && 'col-span-2',
      // Color coding
      variant === 'operator' &&
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
      variant === 'function' &&
        'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100',
      variant === 'memory' &&
        'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300',
      variant === 'danger' &&
        'bg-red-500 hover:bg-red-600 text-white shadow-sm',
      variant === 'equal' &&
        'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md text-lg font-bold',
      variant === 'default' &&
        'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-600',
      className
    );

    return (
      <Button
        variant="ghost"
        className={baseStyles}
        onClick={onClick}
        title={title || label}
        disabled={false}
      >
        {label}
      </Button>
    );
  };

  const isWide = mode === 'scientific';

  return (
    <div
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        width: mode === 'scientific' ? 480 : 320,
      }}
    >
      <div
        className={cn(
          'rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden',
          'transition-all duration-200',
          isMinimized ? 'rounded-b-lg' : ''
        )}
      >
        {/* ── Header Bar (Drag Handle) ── */}
        <div
          className="flex items-center justify-between bg-slate-900 dark:bg-slate-950 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <CalcIcon className="size-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">
              Calculator
            </span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
            >
              {mode === 'basic' ? 'Basic' : 'Scientific'}
            </Badge>
            {mode === 'scientific' && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-300 bg-amber-500/10"
              >
                {isDegrees ? 'DEG' : 'RAD'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {/* Mode toggle */}
            {canSwitchModes && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeToggle();
                }}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Toggle mode"
              >
                <Atom className="size-3.5" />
              </button>
            )}
            {/* Minimize */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized((v) => !v);
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility();
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {!isMinimized && (
          <div className="p-3 space-y-3">
            {/* Display */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 min-h-[72px] flex flex-col justify-end">
              <div className="text-right text-xs text-slate-400 truncate h-5 mb-1">
                {expression || '\u00A0'}
                {openParens > 0 && (
                  <span className="text-amber-400 ml-1">
                    ({openParens} open)
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'text-right text-2xl font-bold tracking-tight truncate',
                  hasError ? 'text-red-400' : 'text-white'
                )}
              >
                {formatDisplay(display)}
              </div>
              {hasMemory && (
                <div className="text-right text-[10px] text-emerald-400 mt-1">
                  M = {formatResult(memory)}
                </div>
              )}
            </div>

            {/* Scientific Functions Row */}
            {mode === 'scientific' && (
              <div className="space-y-2">
                {/* Memory & Angle row */}
                <div className="grid grid-cols-7 gap-1">
                  <CalcBtn
                    label="MC"
                    onClick={handleMemoryClear}
                    variant="memory"
                    title="Memory Clear"
                  />
                  <CalcBtn
                    label="MR"
                    onClick={handleMemoryRecall}
                    variant="memory"
                    title="Memory Recall"
                  />
                  <CalcBtn
                    label="M+"
                    onClick={handleMemoryAdd}
                    variant="memory"
                    title="Memory Add"
                  />
                  <CalcBtn
                    label="M−"
                    onClick={handleMemorySub}
                    variant="memory"
                    title="Memory Subtract"
                  />
                  <CalcBtn
                    label={isDegrees ? 'DEG' : 'RAD'}
                    onClick={() => setIsDegrees((v) => !v)}
                    variant="function"
                    title="Toggle Degrees/Radians"
                  />
                  <CalcBtn
                    label="("
                    onClick={handleParenOpen}
                    variant="function"
                    title="Open Parenthesis"
                  />
                  <CalcBtn
                    label=")"
                    onClick={handleParenClose}
                    variant="function"
                    title="Close Parenthesis"
                    className={openParens <= 0 ? 'opacity-40' : ''}
                  />
                </div>

                {/* Scientific row 1 */}
                <div className="grid grid-cols-7 gap-1">
                  <CalcBtn
                    label="sin"
                    onClick={() => handleFunction('sin', 'sin')}
                    variant="function"
                    title="Sine"
                  />
                  <CalcBtn
                    label="cos"
                    onClick={() => handleFunction('cos', 'cos')}
                    variant="function"
                    title="Cosine"
                  />
                  <CalcBtn
                    label="tan"
                    onClick={() => handleFunction('tan', 'tan')}
                    variant="function"
                    title="Tangent"
                  />
                  <CalcBtn
                    label="sin⁻¹"
                    onClick={() => handleFunction('asin', 'asin')}
                    variant="function"
                    title="Inverse Sine"
                  />
                  <CalcBtn
                    label="cos⁻¹"
                    onClick={() => handleFunction('acos', 'acos')}
                    variant="function"
                    title="Inverse Cosine"
                  />
                  <CalcBtn
                    label="tan⁻¹"
                    onClick={() => handleFunction('atan', 'atan')}
                    variant="function"
                    title="Inverse Tangent"
                  />
                  <CalcBtn
                    label="n!"
                    onClick={handleFactorial}
                    variant="function"
                    title="Factorial"
                  />
                </div>

                {/* Scientific row 2 */}
                <div className="grid grid-cols-7 gap-1">
                  <CalcBtn
                    label="log"
                    onClick={() => handleFunction('log', 'log₁₀')}
                    variant="function"
                    title="Log Base 10"
                  />
                  <CalcBtn
                    label="ln"
                    onClick={() => handleFunction('ln', 'ln')}
                    variant="function"
                    title="Natural Log"
                  />
                  <CalcBtn
                    label="√"
                    onClick={() => handleFunction('sqrt', '√')}
                    variant="function"
                    title="Square Root"
                  />
                  <CalcBtn
                    label="∛"
                    onClick={() => handleFunction('cbrt', '∛')}
                    variant="function"
                    title="Cube Root"
                  />
                  <CalcBtn
                    label="x²"
                    onClick={() => handlePower('**2', '²')}
                    variant="function"
                    title="Square"
                  />
                  <CalcBtn
                    label="x³"
                    onClick={() => handlePower('**3', '³')}
                    variant="function"
                    title="Cube"
                  />
                  <CalcBtn
                    label="xⁿ"
                    onClick={handlePowerBase}
                    variant="function"
                    title="Power (x^n)"
                  />
                </div>

                {/* Scientific row 3 */}
                <div className="grid grid-cols-7 gap-1">
                  <CalcBtn
                    label="10ˣ"
                    onClick={handleTenToX}
                    variant="function"
                    title="10 to the power of x"
                  />
                  <CalcBtn
                    label="eˣ"
                    onClick={handleEToX}
                    variant="function"
                    title="e to the power of x"
                  />
                  <CalcBtn
                    label="|x|"
                    onClick={() => handleFunction('abs', '|')}
                    variant="function"
                    title="Absolute Value"
                  />
                  <CalcBtn
                    label="1/x"
                    onClick={handleInverse}
                    variant="function"
                    title="Reciprocal"
                  />
                  <CalcBtn
                    label="π"
                    onClick={() => handleConstant(Math.PI, 'π')}
                    variant="function"
                    title="Pi (3.14159...)"
                  />
                  <CalcBtn
                    label="e"
                    onClick={() => handleConstant(Math.E, 'e')}
                    variant="function"
                    title="Euler's Number (2.718...)"
                  />
                  <CalcBtn
                    label="%"
                    onClick={handlePercent}
                    variant="function"
                    title="Percent"
                  />
                </div>
              </div>
            )}

            {/* Basic Calculator Grid */}
            <div className="grid grid-cols-4 gap-1">
              {/* Row 1: C, CE, ⌫, ÷ */}
              <CalcBtn
                label="C"
                onClick={handleClear}
                variant="danger"
                title="Clear All"
              />
              <CalcBtn
                label="CE"
                onClick={handleClearEntry}
                variant="danger"
                title="Clear Entry"
              />
              <CalcBtn
                label="⌫"
                onClick={handleBackspace}
                variant="danger"
                title="Backspace"
              />
              <CalcBtn
                label="÷"
                onClick={() => handleOperator('÷')}
                variant="operator"
                title="Divide"
              />

              {/* Row 2: 7, 8, 9, × */}
              <CalcBtn
                label="7"
                onClick={() => handleDigit('7')}
              />
              <CalcBtn
                label="8"
                onClick={() => handleDigit('8')}
              />
              <CalcBtn
                label="9"
                onClick={() => handleDigit('9')}
              />
              <CalcBtn
                label="×"
                onClick={() => handleOperator('×')}
                variant="operator"
                title="Multiply"
              />

              {/* Row 3: 4, 5, 6, - */}
              <CalcBtn
                label="4"
                onClick={() => handleDigit('4')}
              />
              <CalcBtn
                label="5"
                onClick={() => handleDigit('5')}
              />
              <CalcBtn
                label="6"
                onClick={() => handleDigit('6')}
              />
              <CalcBtn
                label="−"
                onClick={() => handleOperator('-')}
                variant="operator"
                title="Subtract"
              />

              {/* Row 4: 1, 2, 3, + */}
              <CalcBtn
                label="1"
                onClick={() => handleDigit('1')}
              />
              <CalcBtn
                label="2"
                onClick={() => handleDigit('2')}
              />
              <CalcBtn
                label="3"
                onClick={() => handleDigit('3')}
              />
              <CalcBtn
                label="+"
                onClick={() => handleOperator('+')}
                variant="operator"
                title="Add"
              />

              {/* Row 5: ±, 0, ., = */}
              {mode === 'basic' ? (
                <>
                  <CalcBtn
                    label="±"
                    onClick={handleNegate}
                    variant="default"
                    title="Negate"
                  />
                  <CalcBtn
                    label="0"
                    onClick={() => handleDigit('0')}
                  />
                  <CalcBtn
                    label="."
                    onClick={handleDecimal}
                    title="Decimal"
                  />
                  <CalcBtn
                    label="="
                    onClick={handleEquals}
                    variant="equal"
                    title="Equals"
                  />
                </>
              ) : (
                <>
                  <CalcBtn
                    label="±"
                    onClick={handleNegate}
                    variant="default"
                    title="Negate"
                  />
                  <CalcBtn
                    label="0"
                    onClick={() => handleDigit('0')}
                  />
                  <CalcBtn
                    label="."
                    onClick={handleDecimal}
                    title="Decimal"
                  />
                  <CalcBtn
                    label="="
                    onClick={handleEquals}
                    variant="equal"
                    title="Equals"
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
