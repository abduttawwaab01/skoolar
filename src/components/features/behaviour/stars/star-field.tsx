'use client';

import { motion } from 'framer-motion';
import { StarButton } from './star-button';

interface StarFieldProps {
  current: number;
  max: number;
  onChange?: (value: number) => void;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function StarField({
  current,
  max,
  onChange,
  color = '#f59e0b',
  size = 'md',
  disabled = false,
}: StarFieldProps) {
  const stars = [];
  for (let i = 0; i < max; i++) {
    const filled = i < current;
    stars.push(
      <StarButton
        key={i}
        filled={filled}
        onClick={() => onChange?.(filled ? i : i + 1)}
        color={color}
        size={size}
        disabled={disabled}
      />
    );
  }
  return (
    <motion.div
      className="flex items-center gap-0.5 justify-center"
      layout
    >
      {stars}
    </motion.div>
  );
}
