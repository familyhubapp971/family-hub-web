import React from 'react';
import { X } from 'lucide-react';
import { Card } from './Card';

// FHS-513: the inline expanding-form shell shared by "Invite an adult"
// and "Add a child" on Manage Members: a white card with a close (X)
// button top-right, a heading, an optional one-line description, then
// whatever form fields the caller renders as children.

export interface FormCardProps {
  title: string;
  description?: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}

export function FormCard({
  title,
  description,
  onClose,
  closeLabel = 'Close form',
  className = '',
  testId,
  children,
}: FormCardProps) {
  return (
    <Card
      className={`relative mb-8 bg-white p-6 ${className}`.trim()}
      {...(testId ? { testId } : {})}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl border-2 border-black bg-white text-gray-500 transition-colors hover:text-black"
      >
        <X size={20} />
      </button>
      <h2 className="mb-2 pr-12 font-heading text-2xl text-black">{title}</h2>
      {description && <p className="mb-6 text-sm font-bold text-gray-600">{description}</p>}
      {children}
    </Card>
  );
}
