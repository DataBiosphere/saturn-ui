import { DeepPartial } from '@terra-ui-packages/core-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import {
  DataTableFeatures,
  DataTableProvider,
  Entity,
  EntityQueryResponse,
} from 'src/libs/ajax/data-table-providers/DataTableProvider';
import { RecordTypeSchema } from 'src/libs/ajax/data-table-providers/WdsDataTableProvider';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultAzureWorkspace } from 'src/testing/workspace-fixtures';

import WDSContent, { WDSContentProps } from './WDSContent';

jest.mock('src/libs/error', () => ({
  ...jest.requireActual('src/libs/error'),
  reportError: jest.fn(),
}));

jest.mock('src/libs/notifications', () => ({
  notify: jest.fn(),
}));

// // DataTable uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows/columns to be rendered in tests.
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 1000, height: 1000 }),
}));

interface SetupOptions {
  props: WDSContentProps;
  features: DataTableFeatures;
  entities: Entity[];
}

const marbleSchema: RecordTypeSchema = {
  name: 'marble',
  count: 1,
  attributes: [
    { name: 'id', datatype: 'NUMBER' },
    { name: 'color', datatype: 'STRING' },
    { name: 'favorite', datatype: 'BOOLEAN' },
  ],
  primaryKey: 'id',
};
const defaultProps: WDSContentProps = {
  workspace: {
    ...defaultAzureWorkspace,
    workspace: {
      ...defaultAzureWorkspace.workspace,
      // attributes are required to avoid an error while destructuring from 'workspace-column-defaults'
      attributes: {},
    },
  },
  recordType: marbleSchema.name,
  wdsSchema: [marbleSchema],
  editable: true,
  dataProvider: {} as DataTableProvider,
};
const defaultFeatures: DataTableFeatures = {
  supportsCapabilities: true,
  supportsTsvDownload: false,
  supportsTsvAjaxDownload: false,
  supportsTypeDeletion: false,
  supportsTypeRenaming: false,
  supportsEntityRenaming: false,
  supportsEntityUpdating: false,
  supportEntityUpdatingTypes: [],
  supportsAttributeRenaming: false,
  supportsAttributeDeleting: false,
  supportsAttributeClearing: false,
  supportsExport: false,
  supportsPointCorrection: false,
  supportsFiltering: false,
  supportsRowSelection: false,
};

const defaultSetupOptions: SetupOptions = {
  props: defaultProps,
  features: defaultFeatures as DataTableFeatures,
  entities: [
    {
      name: '1',
      entityType: 'marble',
      attributes: { color: 'red', favorite: true },
    },
    {
      name: '2',
      entityType: 'marble',
      attributes: { color: 'yellow', favorite: false },
    },
    {
      name: '3',
      entityType: 'marble',
      attributes: { color: 'green', favorite: false },
    },
  ],
};
describe('WDSContent', () => {
  const setup = ({ props, features, entities }: SetupOptions = defaultSetupOptions) => {
    const user = userEvent.setup();

    const getPageResponse: DeepPartial<EntityQueryResponse> = {
      results: entities,
      resultMetadata: {
        unfilteredCount: entities.length,
        filteredCount: entities.length,
        filteredPageCount: entities.length / 100 + 1,
      },
    };

    const dataProvider: DeepPartial<DataTableProvider> = {
      providerName: 'WDS',
      getPage: jest.fn().mockResolvedValue(getPageResponse),
      features,
    };

    return { user, props: { ...props, dataProvider: dataProvider as DataTableProvider } };
  };

  const getColorColumnMenu = () => {
    const columnMenus = screen.queryAllByRole('button', { name: 'Column menu' });
    expect(columnMenus.length).toEqual(3);
    const [_unusedIdColumnMenu, colorColumnMenu] = columnMenus;
    return colorColumnMenu;
  };

  describe('delete column button', () => {
    it('is displayed when editable and supportsAttributeDeleting are true', async () => {
      // Arrange
      const { user, props } = setup({
        ...defaultSetupOptions,
        props: { ...defaultProps, editable: true },
        features: { ...defaultFeatures, supportsAttributeDeleting: true },
      });

      // Act
      await act(() => {
        render(h(WDSContent, props));
      });
      await user.click(getColorColumnMenu());

      const deleteColorColumnButton = screen.getByRole('button', { name: 'Delete Column' });
      const deleteConfirmationButton = screen.queryByTestId('confirm-delete');

      // Assert
      expect(deleteConfirmationButton).not.toBeInTheDocument();
      expect(screen.queryByText(/Are you sure you want to delete the column/)).not.toBeInTheDocument();

      // Act
      await user.click(deleteColorColumnButton);

      // Assert
      expect(screen.getByRole('dialog')).toHaveTextContent(/Are you sure you want to delete the column/);
      expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('confirm-delete'));
    });

    it('is hidden when editable is true, but supportsAttributeDeleting is false', async () => {
      // Arrange
      const { user, props } = setup({
        ...defaultSetupOptions,
        props: { ...defaultProps, editable: true },
        features: { ...defaultFeatures, supportsAttributeDeleting: false },
      });

      // Act
      await act(() => {
        render(h(WDSContent, props));
      });
      await user.click(getColorColumnMenu());

      // Assert
      expect(screen.queryByRole('button', { name: 'Delete Column' })).not.toBeInTheDocument();
    });

    it('is hidden when editable is false, even if supportsAttributeDeleting is true', async () => {
      // Arrange
      const { user, props } = setup({
        ...defaultSetupOptions,
        props: { ...defaultProps, editable: false },
        features: { ...defaultFeatures, supportsAttributeDeleting: true },
      });

      // Act
      await act(() => {
        render(h(WDSContent, props));
      });

      await user.click(getColorColumnMenu());

      // Assert
      expect(screen.queryByRole('button', { name: 'Delete Column' })).not.toBeInTheDocument();
    });

    it('invokes the deleteColumn function on the provided dataTableProvider when confirmed', async () => {
      // Arrange
      const { user, props } = setup({
        ...defaultSetupOptions,
        props: { ...defaultProps, editable: true },
        features: { ...defaultFeatures, supportsAttributeDeleting: true },
      });

      const deleteColumnMock = jest.fn().mockResolvedValue(undefined);
      props.dataProvider.deleteColumn = deleteColumnMock;

      // Act
      await act(() => {
        render(h(WDSContent, props));
      });
      await user.click(getColorColumnMenu());
      await user.click(screen.getByRole('button', { name: 'Delete Column' }));
      await user.click(screen.getByTestId('confirm-delete'));

      // Assert
      expect(deleteColumnMock).toHaveBeenCalledWith(expect.any(AbortSignal), 'marble', 'color');
    });
  });

  describe('edit column', () => {
    it('edit field icon is present for types that support editing', async () => {
      const { props } = setup({
        ...defaultSetupOptions,
        props: { ...defaultProps, editable: true },
        features: {
          ...defaultFeatures,
          supportsEntityUpdating: true,
          supportEntityUpdatingTypes: ['string', 'number'],
        },
      });

      // Act
      await act(() => {
        render(h(WDSContent, props));
      });

      const editableValues = await screen.findAllByText('Edit value');
      expect(editableValues.length).toEqual(3);
    });
  });
});
