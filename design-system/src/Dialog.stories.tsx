import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

// FHS-678: the dialog shell never grows taller than the screen. The tall story
// shows the pattern the feedback forms use: a fixed header, a scrolling body.

function DialogDemo({
  align = 'center',
  tall = false,
}: {
  align?: 'center' | 'bottom-sheet';
  tall?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        ariaLabelledBy="story-dialog-title"
        align={align}
      >
        <div className="relative flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-black bg-white shadow-neo-lg">
          <div className="relative shrink-0 border-b-2 border-black bg-pink-400 px-5 py-4 pr-16">
            <h2 id="story-dialog-title" className="font-display text-xl font-black text-black">
              A dialog title
            </h2>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg border-2 border-black bg-white font-black text-black"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {Array.from({ length: tall ? 24 : 2 }, (_, i) => (
              <p key={i} className="text-sm text-gray-700">
                Line {i + 1}. The header stays in view while this part scrolls.
              </p>
            ))}
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

const meta = {
  title: 'Primitives/Dialog',
  component: DialogDemo,
  args: { align: 'center', tall: false },
  argTypes: {
    align: { control: 'inline-radio', options: ['center', 'bottom-sheet'] },
    tall: { control: 'boolean' },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DialogDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Centred: Story = { args: { align: 'center' } };

/** Taller than the screen: the header stays put and only the body scrolls. */
export const TallContent: Story = { args: { tall: true } };

export const BottomSheet: Story = { args: { align: 'bottom-sheet' } };

export const BottomSheetTall: Story = { args: { align: 'bottom-sheet', tall: true } };
