import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { ButtonPrimary } from 'src/components/common';
import { NameModal } from 'src/components/NameModal';

const meta: Meta<typeof Modal> = {
  title: 'Packages/Components/NameModal',
  component: NameModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onSuccess: {
      control: 'function',
      description: 'callback on submit. Accepts params object { name }',
    },
    onDismiss: {
      control: 'function',
      description: 'callback on dismiss',
    },
    thing: {
      control: 'text',
      description: 'the kind of entity to be named',
    },
    value: {
      control: 'text',
      description: 'the default name',
    },
    validator: {
      control: 'function',
      description:
        'RegExp OR callback returning boolean false if the new name is valid, string error message otherwise',
    },
    validationMessage: {
      control: 'text',
      description: 'error message to show if the validator rejects the new name. Only used when `validator` is a regex',
    },
  },
};

export default meta;
type Story = StoryObj<typeof NameModal>;

export const Example: Story = {
  args: {
    onSuccess: () => {},
    onDismiss: () => {},
    thing: 'Dog',
    value: 'Lassie',
    validator: (value) => (value === 'Fido' ? false : 'I only like dogs named Fido'),
    validationMessage: 'ignored',
  },

  render: (args) => {
    const StoryWrapper = (): React.ReactNode => {
      const [isModalOpen, modalOpen] = useState(false);
      const [value, setValue] = useState({ name: 'Laddie' });
      const showModal = () => {
        modalOpen(true);
      };
      const hideModal = () => {
        modalOpen(false);
      };
      const submitModal = (value) => {
        modalOpen(false);
        setValue(value);
      };
      return (
        <div>
          <div>{`My dog's name is ${value.name}.`}</div>
          <ButtonPrimary onClick={showModal}>Click to show modal</ButtonPrimary>
          {isModalOpen && <NameModal {...args} onDismiss={hideModal} onSuccess={submitModal} />}
        </div>
      );
    };
    return <StoryWrapper />;
  },
};
