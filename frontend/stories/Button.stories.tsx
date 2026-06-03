import type { Meta, StoryObj } from '@storybook/react';

function PrimaryButton({ label }: { label: string }) {
  return (
    <button
      style={{
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        background: '#6c63ff',
        color: 'white',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

const meta = {
  title: 'Smoke/Button',
  component: PrimaryButton,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PrimaryButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Click me' },
};
