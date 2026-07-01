'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { STAR_SIZE_MAP } from '@/lib/behaviour-utils/star-assets';
import { type StarSize } from '@/lib/behaviour-utils/types';

interface StarButtonProps {
  filled: boolean;
  onClick?: () => void;
  color?: string;
  size?: StarSize;
  disabled?: boolean;
}

export function StarButton({
  filled,
  onClick,
  color = '#f59e0b',
  size = 'md',
  disabled = false,
}: StarButtonProps) {
  const px = STAR_SIZE_MAP[size];
  const fillId = `star-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.2, rotate: 15 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      animate={filled ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="inline-flex items-center justify-center bg-transparent p-0 cursor-pointer disabled:cursor-default"
      style={{ width: px + 4, height: px + 4 }}
    >
      <svg width={px} height={px} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {filled && (
            <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          )}
        </defs>
        <motion.path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={filled ? `url(#${fillId})` : 'none'}
          stroke={filled ? 'none' : '#cbd5e1'}
          strokeWidth="1.5"
          initial={false}
          animate={filled ? { fillOpacity: 1 } : { fillOpacity: 0.3 }}
        />
        {filled && (
          <motion.circle
            cx="12" cy="10" r="2"
            fill="rgba(255,255,255,0.4)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6] }}
            transition={{ delay: 0.2, duration: 0.3 }}
          />
        )}
      </svg>
    </motion.button>
  );
}
