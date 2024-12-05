import { expect } from '@storybook/test';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { DropEvent } from 'react-dropzone';
import Dropzone, { DropzoneState } from 'src/components/Dropzone';
import { GCSItem, GCSListObjectsResponse, GoogleStorage, GoogleStorageContract } from 'src/libs/ajax/GoogleStorage';
import { Metrics, MetricsContract } from 'src/libs/ajax/Metrics';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { useRoute } from 'src/libs/nav';
import { asMockedFn, partial, renderWithAppContexts } from 'src/testing/test-utils';

import { UploadData } from './UploadData';

// Mock dependencies
jest.mock('src/libs/ajax/GoogleStorage');
jest.mock('src/libs/ajax/workspaces/Workspaces');
jest.mock('src/libs/ajax/Metrics');

type NavExports = typeof import('src/libs/nav');
jest.mock(
  'src/libs/nav',
  (): NavExports => ({
    ...jest.requireActual<NavExports>('src/libs/nav'),
    getLink: jest.fn(() => '/'),
    goToPath: jest.fn(),
    useRoute: jest.fn().mockReturnValue({ query: {} }),
    updateSearch: jest.fn(),
  })
);

jest.mock('src/libs/state-history', () => ({
  get: jest.fn().mockReturnValue({}),
  update: jest.fn(),
}));

jest.mock('src/workspaces/common/state/useWorkspaces', () => ({
  useWorkspaces: jest.fn().mockReturnValue({
    workspaces: [
      {
        workspace: {
          workspaceId: 'mockWorkspaceId',
          namespace: 'mockNamespace',
          name: 'mockWorkspaceName',
          attributes: {},
          createdBy: 'test@example.com',
          lastModified: '2023-01-01T00:00:00Z',
        },
        accessLevel: 'OWNER',
      },
    ],
    refresh: jest.fn(),
    loading: false,
  }),
}));

jest.mock('src/components/Dropzone', () => {
  const actual = jest.requireActual('src/components/Dropzone');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(actual.default),
  };
});

describe('UploadData Component', () => {
  const files: File[] = [new File(['entity:sample_id\tname'], 'test1.tsv', { type: 'text/tab-separated-values' })];

  beforeEach(() => {
    jest.clearAllMocks();

    asMockedFn(Workspaces).mockReturnValue(
      partial<WorkspacesAjaxContract>({
        getTags: jest.fn().mockResolvedValue([]),
      })
    );

    asMockedFn(Metrics).mockReturnValue(partial<MetricsContract>({ captureEvent: jest.fn() }));

    asMockedFn(GoogleStorage).mockReturnValue(
      partial<GoogleStorageContract>({
        list: jest.fn(async (_googleProject, _bucket, _prefix) =>
          partial<GCSListObjectsResponse>({
            items: [partial<GCSItem>({ name: 'test1.tsv', size: '100', updated: '2023-01-01T00:00:00Z' })],
          })
        ),
        listAll: jest.fn(async (_googleProject, _bucket, _prefix) => ({ items: [] })),
        upload: jest.fn(async () => undefined),
      })
    );

    asMockedFn(Dropzone).mockImplementation((props) => {
      const { onDropAccepted, children } = props;
      const openUploader = async () => {
        onDropAccepted && onDropAccepted(files, {} as DropEvent);
      };
      return <div>{children(partial<DropzoneState>({ dragging: false, openUploader, ...{} }))}</div>;
    });
  });

  const selectOptionAndGoToNext = async (option: any) => {
    (useRoute as jest.Mock).mockReturnValue({
      query: { ...option },
    });

    await waitFor(() => {
      renderWithAppContexts(<UploadData />);
    });

    fireEvent.click(screen.getByText('Next >'));
  };

  const uploadDataFileToStorage = async () => {
    const uploadBtn = screen.getByText('Upload');

    await expect(uploadBtn).toBeInTheDocument();

    fireEvent.click(uploadBtn);
  };

  it('Renders data uploader', () => {
    // Arrange & Act
    renderWithAppContexts(<UploadData />);

    // Assert
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Data Uploader')).toBeInTheDocument();
  });

  it('Displays option to select a workspace', () => {
    // Arrange & Act
    renderWithAppContexts(<UploadData />);

    // Assert
    expect(screen.getByText('Select a Workspace')).toBeInTheDocument();
  });

  it('Allows selection of a workspace and move to the next step', async () => {
    // Arrange & Act
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId' });

    // Assert
    await expect(screen.getByText('Select a collection')).toBeInTheDocument();
  });

  it('Allows selection of a collection and move to the next step', async () => {
    // Arrange & Act
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId', collection: 'collection1' });

    // Assert
    await expect(screen.getByText('Upload Your Data Files')).toBeInTheDocument();
  });

  it('Allows upload of files to dropzone', async () => {
    // Arrange
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId', collection: 'collection1' });

    // Act
    await uploadDataFileToStorage();

    // Assert
    await expect(screen.findByText('test1.tsv')).toBeTruthy();
  });

  it('Can manually upload a metadata TSV file', async () => {
    // Arrange
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId', collection: 'collection1' });

    // Act
    await uploadDataFileToStorage();
    fireEvent.click(screen.getByText('Next >'));

    // Assert
    await expect(screen.findByText('Upload Your Metadata Files')).toBeTruthy();
    await expect(screen.getByRole('table')).toBeInTheDocument();
    await expect(screen.findByText('Create Table')).toBeTruthy();
  });
});
