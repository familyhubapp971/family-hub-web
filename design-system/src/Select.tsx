import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  testId?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className = '', children, testId, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        data-testid={testId}
        className={[
          'w-full text-sm font-bold border-2 rounded-xl px-4 py-3 bg-gray-50 appearance-none transition-colors',
          'outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
          error ? 'border-red-400' : 'border-gray-200 focus:border-pink-400',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  ),
);
Select.displayName = 'Select';
