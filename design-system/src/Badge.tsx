import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  testId?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-600',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-600 border border-red-200',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ children, className = '', variant = 'default', testId }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      className={`
        inline-flex items-center gap-1
        text-xs font-black px-2 py-0.5 rounded-full
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
