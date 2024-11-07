import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import _ from 'lodash/fp';
import React from 'react';
import { MethodResponse } from 'src/libs/ajax/methods/methods-models';
import { PostMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { WorkflowModal } from 'src/workflows/methods/modals/WorkflowModal';

type WDLEditorExports = typeof import('src/workflows/methods/WDLEditor');
jest.mock('src/workflows/methods/WDLEditor', (): WDLEditorExports => {
  const mockWDLEditorModule = jest.requireActual('src/workflows/methods/WDLEditor.mock');
  return {
    WDLEditor: mockWDLEditorModule.MockWDLEditor,
  };
});

const mockCreateMethodResponse: MethodResponse = {
  name: 'response-name',
  createDate: '2024-01-01T15:41:38Z',
  documentation: 'response docs',
  synopsis: 'response synopsis',
  entityType: 'Workflow',
  snapshotComment: 'response comment',
  snapshotId: 1,
  namespace: 'response-namespace',
  payload: 'workflow response {}',
  url: 'http://agora.dsde-dev.broadinstitute.org/api/v1/methods/sschu/response-test/1',
};

const errorPostMethodProvider: PostMethodProvider = {
  postMethod: jest.fn(() => {
    throw new Error('You have not yet risen to the status of Expert WDL Engineer.');
  }),
};

const thrownResponsePostMethodProvider: PostMethodProvider = {
  postMethod: jest.fn(() => {
    throw new Response('You have not yet risen to the status of Expert WDL Engineer.');
  }),
};

const successPostMethodProvider: PostMethodProvider = {
  postMethod: jest.fn().mockResolvedValue(mockCreateMethodResponse),
};

describe('WorkflowModal', () => {
  it('renders key elements with blank default input values', async () => {
    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    // Assert
    expect(screen.getByText('Create New Method'));
    expect(screen.getByText('Namespace *'));
    expect(screen.getByText('Name *'));
    expect(screen.getByText('WDL *'));
    expect(screen.getByRole('button', { name: 'Load WDL from file' }));
    expect(screen.getByText('Documentation'));
    expect(screen.getByText('Synopsis (80 characters max)'));
    expect(screen.getByText('Snapshot comment'));
    expect(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Upload' }));

    expect(screen.getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('');
    expect(screen.getByTestId('wdl editor')).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Snapshot comment' })).toHaveDisplayValue('');
  });

  it('shows an error and disables the action button when the namespace and name inputs are empty', async () => {
    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultWdl='a'
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    // Assert
    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');

    // Act

    // errors only need to appear after the inputs have been modified
    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), { target: { value: 'n' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name *' }), { target: { value: 'n' } });

    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name *' }), { target: { value: '' } });

    // Assert

    // we simply check for at least one instance of each error message because
    // the error messages shown in the modal (under the inputs and in the
    // button tooltip) do not easily correspond to those found by the testing
    // framework
    expect(screen.getAllByText("Namespace can't be blank"));
    expect(screen.getAllByText("Name can't be blank"));

    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows an error and disables the action button when invalid characters are in namespace and name input', async () => {
    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace=','
          defaultName=','
          defaultWdl='a'
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    // Assert

    // we simply check for at least one instance of each error message because
    // the error messages shown in the modal (under the inputs and in the
    // button tooltip) do not easily correspond to those found by the testing
    // framework
    expect(screen.getAllByText('Namespace can only contain letters, numbers, underscores, dashes, and periods'));
    expect(screen.getAllByText('Name can only contain letters, numbers, underscores, dashes, and periods'));

    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows an error and disables the action button when namespace + name length exceeds 250 chars', async () => {
    // Arrange
    const longStringNamespace = _.repeat(125, 't');
    const longStringName = _.repeat(126, 's');

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace={longStringNamespace}
          defaultName={longStringName}
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    // Assert

    // we simply check for at least one instance of the error message because
    // the error messages shown in the modal (under the inputs and in the
    // button tooltip) do not easily correspond to those found by the testing
    // framework
    expect(screen.getAllByText('Namespace and name are too long (maximum is 250 characters total)'));

    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the action button if wdl is blank', async () => {
    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='a'
          defaultName='a'
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    // Assert

    // we simply check for at least one instance of the error message because
    // the error messages shown in the modal do not easily correspond to those
    // found by the testing framework
    expect(screen.getAllByText("WDL can't be blank"));

    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows an error and disables the action button if the synopsis is too long', async () => {
    // Arrange
    const longSynopsis = _.repeat(81, 's');

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='a'
          defaultName='a'
          defaultSynopsis={longSynopsis}
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    const uploadButton = screen.getByRole('button', { name: 'Upload' });

    // Assert

    // we simply check for at least one instance of the error message because
    // the error messages shown in the modal (under the inputs and in the
    // button tooltip) do not easily correspond to those found by the testing
    // framework
    expect(screen.getAllByText('Synopsis is too long (maximum is 80 characters)'));

    expect(uploadButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('allows WDLs to be loaded from a file', async () => {
    // Arrange
    const wdlFile = new File(['workflow hi {}'], 'workflow.txt');

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='namespace'
          defaultName='name'
          defaultWdl='old wdl'
          postMethodProvider={successPostMethodProvider}
          onSuccess={jest.fn()}
          onDismiss={jest.fn()}
        />
      );
    });

    // necessary to get the hidden input element used by the Dropzone
    // (since the main "Load from file" button opens a browser upload
    // window that cannot be used in unit tests)
    const dropzoneInput = screen.getByTestId('dropzone-upload');

    await user.upload(dropzoneInput, wdlFile);

    // Assert

    // we must wait for the file upload to complete
    await waitFor(() => expect(screen.getByTestId('wdl editor')).toHaveTextContent('workflow hi {}'));
  });

  it('successfully submits a workflow with inputted information when you press the upload button', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='testnamespace'
          defaultName='testname'
          defaultWdl='workflow hi {}'
          defaultDocumentation='test docs'
          defaultSynopsis='test synopsis'
          defaultSnapshotComment='test comment'
          postMethodProvider={successPostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), { target: { value: 'newnamespace' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name *' }), { target: { value: 'newname' } });
    fireEvent.change(screen.getByTestId('wdl editor'), { target: { value: 'workflow new {}' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Documentation' }), { target: { value: 'new docs' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' }), {
      target: { value: 'new synopsis' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Snapshot comment' }), { target: { value: 'new comment' } });

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    // Assert
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledTimes(1);
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledWith(
      'newnamespace',
      'newname',
      'workflow new {}',
      'new docs',
      'new synopsis',
      'new comment'
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('response-namespace', 'response-name', 1);
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('honors default input values', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='testnamespace'
          defaultName='testname'
          defaultWdl='workflow hi {}'
          defaultDocumentation='test docs'
          defaultSynopsis='test synopsis'
          defaultSnapshotComment='test comment'
          postMethodProvider={successPostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    // Assert
    expect(screen.getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('testnamespace');
    expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('testname');
    expect(screen.getByTestId('wdl editor')).toHaveDisplayValue('workflow hi {}');
    expect(screen.getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('test docs');
    expect(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('test synopsis');
    expect(screen.getByRole('textbox', { name: 'Snapshot comment' })).toHaveDisplayValue('test comment');

    // Act
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    // Assert
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledTimes(1);
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledWith(
      'testnamespace',
      'testname',
      'workflow hi {}',
      'test docs',
      'test synopsis',
      'test comment'
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('response-namespace', 'response-name', 1);
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('handles errors when submitting a workflow', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='namespace'
          defaultName='name'
          defaultWdl='a'
          postMethodProvider={errorPostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    // Assert
    expect(errorPostMethodProvider.postMethod).toHaveBeenCalledTimes(1);
    expect(errorPostMethodProvider.postMethod).toHaveBeenCalledWith('namespace', 'name', 'a', '', '', '');
    expect(screen.getByText('You have not yet risen to the status of Expert WDL Engineer.')).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('handles a thrown response when submitting a workflow', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='namespace'
          defaultName='name'
          defaultWdl='a'
          postMethodProvider={thrownResponsePostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Upload' }));

    // Assert
    expect(thrownResponsePostMethodProvider.postMethod).toHaveBeenCalledTimes(1);
    expect(thrownResponsePostMethodProvider.postMethod).toHaveBeenCalledWith('namespace', 'name', 'a', '', '', '');
    expect(screen.getByText('You have not yet risen to the status of Expert WDL Engineer.')).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('calls the onDismiss callback when you press the cancel button', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Create New Method'
          buttonActionName='Upload'
          defaultNamespace='namespace'
          defaultName='name'
          defaultWdl='a'
          postMethodProvider={successPostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(successPostMethodProvider.postMethod).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it('displays clone method modal and calls correct function on submit', async () => {
    // Arrange
    const mockOnSuccess = jest.fn();
    const mockOnDismiss = jest.fn();

    const user: UserEvent = userEvent.setup();

    // Act
    await act(async () => {
      render(
        <WorkflowModal
          title='Clone snapshot'
          defaultName='groot-scientific-workflow_copy'
          defaultWdl='workflow do-great-stuff {}'
          defaultDocumentation='I am Groot'
          defaultSynopsis='I am Groot'
          defaultSnapshotComment='I am Groot'
          buttonActionName='Clone snapshot'
          postMethodProvider={successPostMethodProvider}
          onSuccess={mockOnSuccess}
          onDismiss={mockOnDismiss}
        />
      );
    });

    // Assert
    expect(screen.getByRole('textbox', { name: 'Namespace *' })).toHaveDisplayValue('');
    expect(screen.getByRole('textbox', { name: 'Name *' })).toHaveDisplayValue('groot-scientific-workflow_copy');
    expect(screen.getByTestId('wdl editor')).toHaveDisplayValue('workflow do-great-stuff {}');
    expect(screen.getByRole('textbox', { name: 'Documentation' })).toHaveDisplayValue('I am Groot');
    expect(screen.getByRole('textbox', { name: 'Synopsis (80 characters max)' })).toHaveDisplayValue('I am Groot');
    expect(screen.getByRole('textbox', { name: 'Snapshot comment' })).toHaveDisplayValue('I am Groot');

    const cloneMethodButton = screen.getByRole('button', { name: 'Clone snapshot' });

    // Assert
    expect(cloneMethodButton).toHaveAttribute('aria-disabled', 'true');

    // user enters value for 'Namespace' text box
    fireEvent.change(screen.getByRole('textbox', { name: 'Namespace *' }), {
      target: { value: 'groot-test-namespace' },
    });

    // Act
    await user.click(screen.getByRole('button', { name: 'Clone snapshot' }));

    // Assert
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledTimes(1);
    expect(successPostMethodProvider.postMethod).toHaveBeenCalledWith(
      'groot-test-namespace',
      'groot-scientific-workflow_copy',
      'workflow do-great-stuff {}',
      'I am Groot',
      'I am Groot',
      'I am Groot'
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('response-namespace', 'response-name', 1);
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });
});
