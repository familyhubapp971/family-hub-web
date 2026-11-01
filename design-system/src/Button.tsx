import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'pink' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  /** When true, the button stretches to fill its container width (adds `w-full`). */
  fullWidth?: boolean;
  testId?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    testId,
    ...props
  },
  ref,
) {
  // focus-visible ring keeps keyboard users oriented (WCAG 2.4.7): must
  // not drop the ring when removing the default outline.
  // Hover: lift -2px (pointer devices only) + grow shadow → 5px. Press:
  // sink back down + drop shadow. The motion-safe variant gates the
  // transform behind prefers-reduced-motion so vestibular-sensitive
  // users see colour changes only.
  const baseStyles = [
    'inline-flex items-center justify-center font-black rounded-xl border-2 border-black',
    'transition-all duration-150',
    'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-neo-md',
    'active:translate-y-1 active:shadow-none',
    'focus:outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
  ].join(' ');
  // Hover bg-* shifts (variant overrides shadow only on the ghost/borderless variant).
  const variants = {
    primary: 'bg-yellow-400 text-black shadow-neo hover:bg-yellow-300',
    secondary: 'bg-white text-black shadow-neo hover:bg-gray-50',
    ghost:
      'bg-transparent border-transparent shadow-none text-white hover:bg-white/10 motion-safe:hover:translate-y-0 motion-safe:hover:shadow-none',
    danger: 'bg-red-500 text-white shadow-neo hover:bg-red-400',
    success: 'bg-lime-400 text-black shadow-neo hover:bg-lime-300',
    pink: 'bg-pink-400 text-black shadow-neo hover:bg-pink-300',
    purple: 'bg-purple-600 text-white shadow-neo hover:bg-purple-500',
  };
  const sizes = {
    sm: 'px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm',
    md: 'px-4 py-2.5 text-sm sm:px-5 sm:py-3 sm:text-base',
    lg: 'px-6 py-3 text-lg sm:px-8 sm:py-4 sm:text-xl',
  };
  return (
    <button
      ref={ref}
      className={[baseStyles, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
      {...props}
    >
      {children}
    </button>
  );
});
