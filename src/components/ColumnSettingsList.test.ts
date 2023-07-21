import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { h } from 'react-hyperscript-helpers';
import { ColumnData, ColumnSettingsList, dragEndNotifier } from 'src/components/ColumnSettingsList';

const visibleColumnA: ColumnData = {
  id: 'a',
  name: 'Column A',
  visible: true,
};

const nonVisibleColumnB: ColumnData = {
  id: 'b',
  name: 'Column B',
  visible: false,
};

const items: ColumnData[] = [visibleColumnA, nonVisibleColumnB];

const onChange = jest.fn();
const toggleVisibility = jest.fn();

// ColumnSettingsList uses react-virtualized's AutoSizer to size the table.
// This makes the virtualized window large enough for all rows to be rendered in tests
jest.mock('react-virtualized', () => ({
  ...jest.requireActual('react-virtualized'),
  AutoSizer: ({ children }) => children({ width: 200, height: 200 }),
}));

describe('ColumnSettingsList', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('has no accessibility issues and explains keyboard shortcuts', async () => {
    const { container } = render(h(ColumnSettingsList, { items, onChange, toggleVisibility }));
    expect(await axe(container)).toHaveNoViolations();
    expect(screen.getByText(/begin a drag, press the space bar or Enter/i)).toBeInTheDocument();
    expect(screen.getByText(/use the up and down arrow keys to move/i)).toBeInTheDocument();
    expect(screen.getByText(/space or Enter again to drop/i)).toBeInTheDocument();
    expect(screen.getByText(/press the letter q to cancel/i)).toBeInTheDocument();
  });

  it('supports toggling column visibility', async () => {
    const user = userEvent.setup();

    render(h(ColumnSettingsList, { items, onChange, toggleVisibility }));
    const columnACheckbox = screen.getByLabelText('Show "Column A" in table');
    expect(columnACheckbox).toBeChecked();
    await user.click(columnACheckbox);
    expect(toggleVisibility).toBeCalledWith(0);

    const columnBCheckbox = screen.getByLabelText('Show "Column B" in table');
    expect(columnBCheckbox).not.toBeChecked();
    await user.click(columnBCheckbox);
    expect(toggleVisibility).toBeCalledWith(1);
  });

  it('supports cancelling a drag initiated by keyboard', async () => {
    const user = userEvent.setup();
    render(h(ColumnSettingsList, { items, onChange, toggleVisibility }));

    // Click on the drag button put focus there.
    const columnADragButton = screen.getByLabelText('Drag button for "Column A", currently at position 1');
    await user.click(columnADragButton);

    // Initiate the drag via space.
    fireEvent.keyDown(columnADragButton, { key: 'Space', code: 'Space' });
    await screen.findByText('Picked up "Column A". Column "Column A" is in position 1 of 2.');

    // Cancel the drag by pressing Q.
    fireEvent.keyDown(columnADragButton, { key: 'KeyQ', code: 'KeyQ' });
    await screen.findByText('Dragging was cancelled. "Column A" was dropped.');

    expect(onChange).toBeCalledTimes(0);
  });

  it('updates the items when onDragEnd is called', async () => {
    // Unfortunately we can't test actually completing a drag with user events because of the virtual dom
    // (elements have zero bounding rectangles, and mocking would be difficult to maintain).
    const active = visibleColumnA;
    const over = nonVisibleColumnB;
    dragEndNotifier({ active, over, items, onChange });
    expect(onChange).toBeCalledWith([nonVisibleColumnB, active]);
  });

  it('does not update items when onDragEnd is called but there has been no update', async () => {
    // active element hasn't changed
    dragEndNotifier({ active: visibleColumnA, over: visibleColumnA, items, onChange });
    // active element didn't move over an actual element
    dragEndNotifier({ active: visibleColumnA, over: undefined, items, onChange });
    expect(onChange).toBeCalledTimes(0);
  });
});
