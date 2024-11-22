import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import _ from 'lodash/fp';
import React from 'react';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { EditMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { EditWorkflowModal } from 'src/workflows/methods/modals/EditWorkflowModal';

type WDLEditorExports = typeof import('src/workflows/methods/WDLEditor');
jest.mock('src/workflows/methods/WDLEditor', (): WDLEditorExports => {
  const mockWDLEditorModule = jest.requireActual('src/workflows/methods/WDLEditor.mock');
  return {
    WDLEditor: mockWDLEditorModule.MockWDLEditor,
  };
});

const mockCreateSnapshotResponse: MethodResponse = {
  name: 'my-workflow',
  createDate: '2024-11-22T11:22:44Z',
  documentation: 'documentation',
  synopsis: 'synopsis',
  entityType: 'Workflow',
  snapshotComment: 'snapshot comment',
  snapshotId: 4,
  namespace: 'my-namespace',
  payload: 'workflow doStuff {}',
  url: 'https://agora.dsde-dev.broadinstitute.org/api/v1/methods/my-namespace/my-workflow/4',
};

const editMethodProviderError: EditMethodProvider = {
  createNewSnapshot: jest.fn(() => {
    throw new Error('Error thrown for testing purposes!');
  }),
};

const editMethodProviderErrorResponse: EditMethodProvider = {
  createNewSnapshot: jest.fn(() => {
    throw new Response('Error response thrown for testing purposes!');
  }),
};

const editMethodProviderSuccess: EditMethodProvider = {
  createNewSnapshot: jest.fn().mockResolvedValue(mockCreateSnapshotResponse),
};

describe('EditWorkflowModal', () => {
  it('renders elements with given values', async () => {
    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    // Assert
    expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveAttribute('placeholder', 'my-namespace');
    expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveAttribute('disabled');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('placeholder', 'my-workflow');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('disabled');
    expect(screen.getByTestId('wdl editor')).toHaveDisplayValue('workflow doStuff {}');
    expect(screen.getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('documentation');
    expect(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Snapshot comment' })).toHaveDisplayValue('');
  });

  it('successfully creates a new snapshot with inputted information', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' }), {
      target: { value: 'synopsis' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Snapshot comment' }), {
      target: { value: 'snapshot comment' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Delete snapshot 3' }));

    await user.click(screen.getByRole('button', { name: 'Create new snapshot' }));

    // Assert
    expect(editMethodProviderSuccess.createNewSnapshot).toHaveBeenCalledTimes(1);
    expect(editMethodProviderSuccess.createNewSnapshot).toHaveBeenCalledWith(
      'my-namespace',
      'my-workflow',
      3,
      true,
      'synopsis',
      'documentation',
      'workflow doStuff {}',
      'snapshot comment'
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('my-namespace', 'my-workflow', 4);
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('handles error when creating new snapshot', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderError}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Create new snapshot' }));

    // Assert
    expect(editMethodProviderError.createNewSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Error thrown for testing purposes!')).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('handles error response when creating new snapshot', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderErrorResponse}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Create new snapshot' }));

    // Assert
    expect(editMethodProviderErrorResponse.createNewSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Error response thrown for testing purposes!')).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('allows WDLs to be loaded from a file', async () => {
    // Arrange
    const wdlFile = new File(['workflow hi {}'], 'workflow.txt');

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    // necessary to get the hidden input element used by the Dropzone
    // (since the main "Load from file" button opens a browser upload
    // window that cannot be used in unit tests)
    const dropzoneInput = screen.getByTestId('dropzone-upload');

    // user changes WDL content
    await user.upload(dropzoneInput, wdlFile);

    // Assert
    // we must wait for the file upload to complete
    await waitFor(() => expect(screen.getByTestId('wdl editor')).toHaveTextContent('workflow hi {}'));
  });

  it('disables the create snapshot button if wdl is blank', async () => {
    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    fireEvent.change(screen.getByTestId('wdl editor'), {
      target: { value: '' },
    });

    // Assert
    expect(screen.getAllByText("WDL can't be blank"));
    const createSnapshotButton = screen.getByRole('button', { name: 'Create new snapshot' });
    expect(createSnapshotButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the create snapshot button if the synopsis is too long', async () => {
    // Arrange
    const longSynopsis = _.repeat(81, 's');

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' }), {
      target: { value: longSynopsis },
    });

    // Assert
    expect(screen.getAllByText('Synopsis is too long (maximum is 80 characters)'));
    const createSnapshotButton = screen.getByRole('button', { name: 'Create new snapshot' });
    expect(createSnapshotButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls the onDismiss callback when on cancel', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <EditWorkflowModal
          title='Edit'
          namespace='my-namespace'
          name='my-workflow'
          snapshotId={3}
          defaultWdl='workflow doStuff {}'
          defaultDocumentation='documentation'
          defaultSynopsis=''
          editMethodProvider={editMethodProviderSuccess}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(editMethodProviderSuccess.createNewSnapshot).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).toHaveBeenCalled();
  });
});
