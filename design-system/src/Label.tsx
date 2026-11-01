import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  testId?: string;
}

export function Label({ children, required, className = '', testId, ...props }: LabelProps) {
  return (
    <label
      className={`block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5 ${className}`}
      data-testid={testId}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
