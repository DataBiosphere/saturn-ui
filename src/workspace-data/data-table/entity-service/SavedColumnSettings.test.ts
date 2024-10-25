import { DeepPartial } from '@terra-ui-packages/core-utils';
import { asMockedFn } from '@terra-ui-packages/test-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { h } from 'react-hyperscript-helpers';
import { Ajax, AjaxContract } from 'src/libs/ajax';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import { defaultGoogleWorkspace } from 'src/testing/workspace-fixtures';

import { ColumnSettingsWithSavedColumnSettings } from './SavedColumnSettings';

const onChange = jest.fn();

jest.mock('src/libs/ajax');

const workspaceDetails = jest.fn().mockResolvedValue({
  workspace: {
    attributes: {
      'system:columnSettings': {
        tables: { sample: { saved: ['Column A', true, 'Column B', false, 'Column C', true] } },
      },
    },
  },
});
const workspace = jest.fn(() => ({ details: workspaceDetails }));

asMockedFn(Ajax).mockImplementation(
  () =>
    ({
      Workspaces: { workspace },
      Metrics: { captureEvent: jest.fn() },
    } as DeepPartial<AjaxContract> as AjaxContract)
);

// ColumnSettingsList uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows to be rendered in tests
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 200, height: 200 }),
}));

describe('ColumnSettingsWithSavedColumnSettings', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('loads saved column settings', async () => {
    const user = userEvent.setup();
    const columnSettings = [
      { name: 'Column A', visible: true },
      { name: 'Column B', visible: true },
      { name: 'Column C', visible: true },
    ];
    const entityMetadata = {
      sample: { count: 1, idName: 'sample_id', attributeNames: ['Column A', 'Column B', 'Column C'] },
    };
    // workspace, snapshotName, entityType, entityMetadata, columnSettings, onLoad
    await act(async () => {
      render(
        h(ColumnSettingsWithSavedColumnSettings, {
          columnSettings,
          onChange,
          workspace: defaultGoogleWorkspace,
          entityType: 'sample',
          entityMetadata,
        })
      );
    });
    const columnACheckbox = screen.getByRole('checkbox', { name: 'Show "Column A" in table' });
    expect(columnACheckbox).toBeChecked();
    const columnBCheckbox = screen.getByRole('checkbox', { name: 'Show "Column B" in table' });
    expect(columnBCheckbox).toBeChecked();
    const columnCCheckbox = screen.getByRole('checkbox', { name: 'Show "Column C" in table' });
    expect(columnCCheckbox).toBeChecked();
    // Load saved column settings
    const menu = screen.getByRole('button', { name: 'Column selection menu' });
    await user.click(menu);
    const load = screen.getByRole('button', { name: 'Load' });
    await user.click(load);
    expect(columnBCheckbox).not.toBeChecked();
  });
});
