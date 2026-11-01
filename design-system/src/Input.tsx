import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /**
   * Visual variant.
   *  - `'default'` (gray-50 background, gray border, pink focus): for
   *    forms on a white app surface.
   *  - `'dark'` (white background, hard 2px black border, purple focus
   *    ring): for the MP-design forms on white cards over kingdom-purple
   *    surfaces (Register, Onboarding).
   */
  variant?: 'default' | 'dark';
  testId?: string;
}

// forwardRef so consumers can attach refs (focus management, react-hook-
// form register, scroll-into-view). Plus focus-visible ring for WCAG 2.4.7.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, variant = 'default', className = '', testId, ...props }, ref) => {
    const base =
      'w-full text-sm font-bold border-2 rounded-xl px-4 py-3 transition-colors outline-none focus-visible:ring-4 focus-visible:ring-offset-2';

    const variants = {
      default: [
        'bg-gray-50',
        'focus-visible:ring-pink-400',
        error ? 'border-red-400' : 'border-gray-200 focus:border-pink-400',
      ].join(' '),
      dark: [
        'bg-white',
        'focus-visible:ring-purple-500',
        error ? 'border-red-500' : 'border-black focus:border-purple-500',
      ].join(' '),
    };

    return (
      <input
        ref={ref}
        data-testid={testId}
        className={[base, variants[variant], className].filter(Boolean).join(' ')}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  testId?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', testId, ...props }, ref) => (
    <textarea
      ref={ref}
      data-testid={testId}
      className={[
        'w-full text-sm border-2 rounded-xl px-4 py-3 bg-gray-50 resize-none transition-colors',
        'outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
        error ? 'border-red-400' : 'border-gray-200 focus:border-pink-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
