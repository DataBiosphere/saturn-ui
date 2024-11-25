import { expect } from '@storybook/test';
import { act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { Workspaces, WorkspacesAjaxContract } from 'src/libs/ajax/workspaces/Workspaces';
import { useRoute } from 'src/libs/nav';
import { asMockedFn, partial, renderWithAppContexts } from 'src/testing/test-utils';

import { UploadData } from './UploadData';

// Mock dependencies
jest.mock('src/libs/ajax/GoogleStorage', () => ({
  GoogleStorage: jest.fn().mockReturnValue({
    list: jest.fn().mockResolvedValue({ prefixes: [] }),
    listAll: jest.fn().mockResolvedValue({ items: [] }),
  }),
}));

jest.mock('src/libs/ajax/workspaces/Workspaces', () => ({
  Workspaces: jest.fn().mockReturnValue({
    workspace: jest.fn().mockReturnValue({
      importFlexibleEntitiesFileSynchronous: jest.fn().mockResolvedValue({}),
      autoGenerateTsv: jest.fn().mockResolvedValue(new File([], 'autoGenerated.tsv')),
    }),
  }),
}));

asMockedFn(Workspaces).mockReturnValue(
  partial<WorkspacesAjaxContract>({
    getTags: jest.fn().mockResolvedValue([]),
  })
);

jest.mock('src/libs/ajax/Metrics', () => ({
  Metrics: jest.fn().mockReturnValue({
    captureEvent: jest.fn(),
  }),
}));

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

jest.mock('src/libs/feature-previews', () => ({
  isFeaturePreviewEnabled: jest.fn(),
}));

describe('UploadData Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const selectOptionAndGoToNext = async (option: any) => {
    (useRoute as jest.Mock).mockReturnValue({
      query: { ...option },
    });

    await act(async () => {
      renderWithAppContexts(<UploadData />);
    });

    fireEvent.click(screen.getByText('Next >'));
  };

  it('Renders data uploader', () => {
    renderWithAppContexts(<UploadData />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Data Uploader')).toBeInTheDocument();
  });

  it('Displays option to select a workspace', () => {
    renderWithAppContexts(<UploadData />);
    expect(screen.getByText('Select a Workspace')).toBeInTheDocument();
  });

  it('Allows selection of a workspace and move to the next step', async () => {
    // Select workspace
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId' });
    await expect(screen.getByText('Select a collection')).toBeInTheDocument();
  });

  it('Allows selection of a collection and move to the next step', async () => {
    // Select workspace & collection
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId', collection: 'collection1' });
    await expect(screen.getByText('Upload Your Data Files')).toBeInTheDocument();
  });

  it('Can manually upload a metadata TSV file', async () => {
    // Select workspace & collection
    await selectOptionAndGoToNext({ workspace: 'mockWorkspaceId', collection: 'collection1' });

    // Upload metadata file
    const file = new File(['entity:collection1_id\tname\n1\tTest'], 'metadata.tsv', {
      type: 'text/tab-separated-values',
    });
    const input = screen.getByTestId('dropzone-upload') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], writable: false });

    await act(async () => {
      fireEvent.change(input);
    });

    await expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
