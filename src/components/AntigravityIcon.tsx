import React from 'react';

interface AntigravityIconProps {
  className?: string;
  size?: number;
  mode?: 'gradient' | 'amber' | 'accent' | 'monochrome';
}

export const AntigravityIcon: React.FC<AntigravityIconProps> = ({
  className = 'w-4 h-4',
  size = 16,
  mode = 'gradient',
}) => {
  const gradientId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {mode === 'gradient' && (
          <linearGradient id={gradientId} x1="2" y1="21" x2="22" y2="3" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="25%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        )}
        {(mode === 'amber' || (mode as any) === 'accent') && (
          <linearGradient id={gradientId} x1="2" y1="21" x2="22" y2="3" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--veron-border-accent, #b45309)" />
            <stop offset="50%" stopColor="var(--veron-accent, #f59e0b)" />
            <stop offset="100%" stopColor="var(--veron-accent-hover, #fbbf24)" />
          </linearGradient>
        )}
      </defs>
      <path
        d="M 21.45,21.19 L 20.93,21.19 L 20.35,21.00 L 19.44,20.35 L 18.44,19.41 L 17.15,17.73 L 15.40,14.75 L 14.20,13.42 L 13.42,12.97 L 12.26,12.71 L 11.03,12.84 L 9.86,13.42 L 8.86,14.49 L 6.34,18.57 L 4.62,20.35 L 3.72,21.00 L 3.20,21.19 L 2.42,21.19 L 2.06,20.90 L 2.00,20.58 L 2.13,20.19 L 3.49,18.63 L 4.27,17.40 L 4.91,16.05 L 5.82,13.52 L 7.11,8.80 L 8.15,5.95 L 9.06,4.39 L 10.19,3.33 L 10.83,3.00 L 11.61,2.81 L 13.04,2.94 L 13.68,3.20 L 14.39,3.72 L 15.40,4.98 L 16.37,7.05 L 18.25,13.52 L 19.09,15.92 L 20.06,17.86 L 21.94,20.25 L 22.00,20.71 L 21.87,20.96 L 21.45,21.19 Z"
        fill={mode === 'monochrome' ? 'currentColor' : `url(#${gradientId})`}
      />
    </svg>
  );
};
