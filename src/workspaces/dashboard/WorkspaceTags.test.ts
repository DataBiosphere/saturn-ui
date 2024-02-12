import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Ajax } from 'src/libs/ajax';
import Events, { extractWorkspaceDetails } from 'src/libs/events';
import { asMockedFn, renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';
import { WorkspaceTags } from 'src/workspaces/dashboard/WorkspaceTags';

type AjaxContract = ReturnType<typeof Ajax>;
type AjaxExports = typeof import('src/libs/ajax');

jest.mock('src/libs/ajax', (): AjaxExports => {
  return {
    ...jest.requireActual('src/libs/ajax'),
    Ajax: jest.fn(),
  };
});

// set the collapsable panel to be open
jest.mock('src/libs/prefs', (): typeof import('src/libs/prefs') => ({
  ...jest.requireActual('src/libs/prefs'),
  getLocalPref: jest.fn().mockReturnValue(true),
}));

describe('WorkspaceTags', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('displays the tags provided on the workspace', async () => {
    // Arrange

    // Act
    await act(() =>
      render(
        h(WorkspaceTags, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {
                'tag:tags': {
                  itemsType: 'AttributeValue',
                  items: ['tag a', 'tag b'],
                },
              },
            },
            workspaceInitialized: true,
          },
          canEdit: true,
        })
      )
    );

    // Assert
    expect(screen.queryByText('tag a')).not.toBeNull();
    expect(screen.queryByText('tag b')).not.toBeNull();
  });

  it('updates the list of tags when saving a new tag', async () => {
    // Arrange
    const initialTags = ['tag a', 'tag b'];
    const addedTag = 'new tag';
    const mockAddTagsFn = jest.fn().mockResolvedValue([...initialTags, addedTag]);
    const mockCaptureEvent = jest.fn();
    asMockedFn(Ajax).mockReturnValue({
      Metrics: { captureEvent: mockCaptureEvent } as Partial<AjaxContract['Metrics']>,
      Workspaces: {
        // the tags select component still calls this
        getTags: jest.fn().mockResolvedValue([initialTags]),
        workspace: jest.fn().mockReturnValue({
          addTag: mockAddTagsFn,
        }),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);
    const user = userEvent.setup();

    // Act
    await act(() =>
      render(
        h(WorkspaceTags, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {
                'tag:tags': {
                  itemsType: 'AttributeValue',
                  items: initialTags,
                },
              },
            },
            workspaceInitialized: true,
          },
          canEdit: true,
        })
      )
    );
    expect(screen.queryByText('tag a')).not.toBeNull();
    expect(screen.queryByText(addedTag)).toBeNull();

    const tagInput = screen.getByText('Add a tag');

    await user.click(tagInput);
    await user.keyboard(addedTag);
    await user.keyboard('[Enter]');

    // Assert
    await waitFor(() => expect(screen.queryByText(addedTag)).not.toBeNull());
    expect(screen.queryByText('tag a')).not.toBeNull();
    expect(screen.queryByText('tag b')).not.toBeNull();
    expect(mockAddTagsFn).toBeCalled();
    expect(mockCaptureEvent).toBeCalledWith(Events.workspaceDashboardAddTag, {
      tag: addedTag,
      ...extractWorkspaceDetails(defaultGoogleWorkspace),
    });
  });

  it('updates the list of tags when deleting a tag', async () => {
    // Arrange
    const remainingTag = 'tag a';
    const deletingTag = 'tag b';

    const initialTags = [remainingTag, deletingTag];
    const mockDeleteTagsFn = jest.fn().mockResolvedValue([remainingTag]);
    const mockCaptureEvent = jest.fn();
    asMockedFn(Ajax).mockReturnValue({
      Metrics: { captureEvent: mockCaptureEvent } as Partial<AjaxContract['Metrics']>,
      Workspaces: {
        // the tags select component still calls this
        getTags: jest.fn().mockResolvedValue([]),
        workspace: jest.fn().mockReturnValue({
          deleteTag: mockDeleteTagsFn,
        }),
      },
    } as DeepPartial<AjaxContract> as AjaxContract);
    const user = userEvent.setup();

    // Act
    await act(() =>
      render(
        h(WorkspaceTags, {
          workspace: {
            ...defaultGoogleWorkspace,
            workspace: {
              ...defaultGoogleWorkspace.workspace,
              attributes: {
                'tag:tags': {
                  itemsType: 'AttributeValue',
                  items: initialTags,
                },
              },
            },
            workspaceInitialized: true,
          },
          canEdit: true,
        })
      )
    );
    expect(screen.queryByText(remainingTag)).not.toBeNull();
    expect(screen.queryByText(deletingTag)).not.toBeNull();

    const tagItem = screen.getByText(deletingTag);
    const removeButton = within(tagItem).getByRole('button');
    await user.click(removeButton);

    // Assert
    await waitFor(() => expect(screen.queryByText(deletingTag)).toBeNull());
    expect(screen.queryByText(remainingTag)).not.toBeNull();
    expect(mockDeleteTagsFn).toBeCalled();
    expect(mockCaptureEvent).toBeCalledWith(Events.workspaceDashboardDeleteTag, {
      tag: deletingTag,
      ...extractWorkspaceDetails(defaultGoogleWorkspace),
    });
  });
});
