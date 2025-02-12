import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { renderWithAppContexts as render } from 'src/testing/test-utils';
import InputsTable from 'src/workflows-app/components/InputsTable';
import {
  runSetInputDef,
  runSetInputDefSameInputNames,
  runSetInputDefWithArrayMessages,
  runSetInputDefWithCompleteStruct,
  runSetInputDefWithEmptySources,
  runSetInputDefWithSourceNone,
  runSetInputDefWithStruct,
  runSetInputDefWithWrongTypes,
  typesResponse,
  typesResponseWithoutFooRating,
} from 'src/workflows-app/utils/mock-responses';
import { validateInputs } from 'src/workflows-app/utils/submission-utils';

jest.mock('src/libs/nav', () => ({
  ...jest.requireActual('src/libs/nav'),
  getCurrentUrl: jest.fn().mockReturnValue('terra'),
}));

jest.mock('src/libs/notifications');
jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('src/components/input', () => ({
  ...jest.requireActual('src/components/input'),
  DelayedSearchInput: jest.requireActual('src/components/input').SearchInput,
}));

// SubmissionConfig component uses AutoSizer to determine the right size for table to be displayed. As a result we need to
// mock out the height and width so that when AutoSizer asks for the width and height of "browser" it can use the mocked
// values and render the component properly. Without this the tests will be break.
// (see https://github.com/bvaughn/react-virtualized/issues/493 and https://stackoverflow.com/a/62214834)
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;

const setupInputTableTest = ({
  selectedDataTable = typesResponse[0],
  configuredInputDefinition = runSetInputDef,
} = {}) => {
  const setConfiguredInputDefinition = jest.fn();
  const inputValidations = validateInputs(configuredInputDefinition, _.keyBy('name', selectedDataTable.attributes));

  const { rerender } = render(
    h(InputsTable, {
      selectedDataTable,
      configuredInputDefinition,
      setConfiguredInputDefinition,
      inputValidations,
    })
  );

  return {
    selectedDataTable,
    configuredInputDefinition,
    setConfiguredInputDefinition,
    inputValidations,
    rerender,
  };
};

describe('Input table rendering', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  });

  it('Searching filters the displayed rows', async () => {
    setupInputTableTest();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(4);
    const cells1 = within(rows[1]).getAllByRole('cell');
    const cells2 = within(rows[2]).getAllByRole('cell');
    const cells3 = within(rows[3]).getAllByRole('cell');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('bar_string');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');

    // search for inputs belonging to target_workflow_1 task (removes foo_rating_workflow_var)
    const searchInput = screen.getByLabelText('Search inputs');
    await user.type(searchInput, 'target_wor');

    expect(within(table).getAllByRole('row').length).toBe(3);

    within(cells1[0]).getByText('target_workflow_1');
    within(cells1[1]).getByText('bar_string_workflow_var');
    within(cells1[2]).getByText('String');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('bar_string');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('optional_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Type a Value');
    within(cells2[4]).getByDisplayValue('Hello World');

    // search for inputs with rating in name
    await user.clear(searchInput);
    await user.type(searchInput, 'rating');

    expect(within(table).getAllByRole('row').length).toBe(2);

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');
  });

  it('Record lookup only shows attributes with matching type', async () => {
    setupInputTableTest();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(4);
    const cells1 = within(rows[1]).getAllByRole('cell');
    const cells2 = within(rows[2]).getAllByRole('cell');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    const fooRecord = within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    const barRecord = within(cells2[4]).getByText('bar_string');

    // see what records are available for Int input (foo)
    // foo_rating is the only NUMBER attribute
    await user.click(fooRecord);
    const fooRecordOptions = within(screen.getByRole('listbox')).getAllByText(/[[a-z]|[A-Z]|[0-9]]+/i);
    expect(fooRecordOptions).toHaveLength(1);

    // see what records are available for String input (bar)
    // bar_string and sys_name are STRING attributes, and foo_rating (NUMBER) can be coerced to string
    await user.click(barRecord);
    const barRecordOptions = within(screen.getByRole('listbox')).getAllByText(/[[a-z]|[A-Z]|[0-9]]+/i);
    expect(barRecordOptions).toHaveLength(3);
  });

  it('should change input table sort order when column headers are clicked', async () => {
    setupInputTableTest();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const headers = within(rows[0]).getAllByRole('columnheader');
    const cells1 = within(rows[1]).getAllByRole('cell');
    const cells2 = within(rows[2]).getAllByRole('cell');
    const cells3 = within(rows[3]).getAllByRole('cell');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('bar_string');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');

    // sort descending by column 1 - required inputs stay at top
    await user.click(within(headers[0]).getByRole('button'));

    within(cells1[0]).getByText('target_workflow_1');
    within(cells1[1]).getByText('bar_string_workflow_var');
    within(cells1[2]).getByText('String');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('bar_string');

    within(cells2[0]).getByText('foo');
    within(cells2[1]).getByText('foo_rating_workflow_var');
    within(cells2[2]).getByText('Int');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('foo_rating');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');

    // sort ascending by column 2 - required inputs stay at top
    await user.click(within(headers[1]).getByRole('button'));

    within(cells1[0]).getByText('target_workflow_1');
    within(cells1[1]).getByText('bar_string_workflow_var');
    within(cells1[2]).getByText('String');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('bar_string');

    within(cells2[0]).getByText('foo');
    within(cells2[1]).getByText('foo_rating_workflow_var');
    within(cells2[2]).getByText('Int');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('foo_rating');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');
  });

  it('should hide/show optional inputs when respective button is clicked', async () => {
    setupInputTableTest();
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(4);
    const cells1 = within(rows[1]).getAllByRole('cell');
    const cells2 = within(rows[2]).getAllByRole('cell');
    const cells3 = within(rows[3]).getAllByRole('cell');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('bar_string');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');

    // hide optional inputs (defaults to showing optional inputs)
    const hideButton = screen.getByText('Hide optional inputs');
    await user.click(hideButton);
    screen.getByText('Show optional inputs');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('bar_string');

    // show optional inputs again
    const showButton = screen.getByText('Show optional inputs');
    await user.click(showButton);
    screen.getByText('Hide optional inputs');

    within(cells1[0]).getByText('foo');
    within(cells1[1]).getByText('foo_rating_workflow_var');
    within(cells1[2]).getByText('Int');
    within(cells1[3]).getByText('Fetch from Data Table');
    within(cells1[4]).getByText('foo_rating');

    within(cells2[0]).getByText('target_workflow_1');
    within(cells2[1]).getByText('bar_string_workflow_var');
    within(cells2[2]).getByText('String');
    within(cells2[3]).getByText('Fetch from Data Table');
    within(cells2[4]).getByText('bar_string');

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('optional_var');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('Type a Value');
    within(cells3[4]).getByDisplayValue('Hello World');
  });

  it('should display struct builder modal when "view struct builder" link is clicked', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithStruct });
    const user = userEvent.setup();

    // ** ASSERT **
    screen.getByRole('table'); // there should be only one table at this point

    const viewStructLink = screen.getByText('View Struct');
    await user.click(viewStructLink);
    screen.getByText('myOptional');
    screen.getByText('myInnerStruct');

    const structTable = screen.getByLabelText('struct-table');
    const structRows = within(structTable).getAllByRole('row');
    expect(structRows.length).toBe(6);

    const headers = within(structRows[0]).getAllByRole('columnheader');
    within(headers[0]).getByText('Struct');
    within(headers[1]).getByText('Variable');
    within(headers[2]).getByText('Type');
    within(headers[3]).getByText('Input sources');
    within(headers[4]).getByText('Input value');

    const structCells = within(structRows[2]).getAllByRole('cell');
    within(structCells[1]).getByText('myInnerStruct');
    const viewMyInnerStructLink = within(structCells[4]).getByText('View Struct');

    await user.click(viewMyInnerStructLink);
    const myInnerStructTable = screen.getByLabelText('struct-table');
    const myInnerStructRows = within(myInnerStructTable).getAllByRole('row');
    expect(myInnerStructRows.length).toBe(3);

    const myInnerStructBreadcrumbs = screen.getByLabelText('struct-breadcrumbs');
    const myInnerStructBreadcrumbsButtons = within(myInnerStructBreadcrumbs).getAllByRole('button');
    expect(myInnerStructBreadcrumbsButtons.length).toBe(1);
    await user.click(myInnerStructBreadcrumbsButtons[0]);

    const structTable2ndView = screen.getByLabelText('struct-table');
    const structRows2ndView = within(structTable2ndView).getAllByRole('row');
    expect(structRows2ndView.length).toBe(6);

    const modalDoneButton = screen.getByText('Done');
    await user.click(modalDoneButton);
    screen.getByRole('table'); // there should be only one table again
  });

  it('should suggest fields from data table with matching names', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefSameInputNames });

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const cells1 = within(rows[1]).getAllByRole('cell');
    const cells2 = within(rows[2]).getAllByRole('cell');
    const cells3 = within(rows[3]).getAllByRole('cell');

    screen.getByText('Autofill (2) from data table');

    within(cells1[0]).getByText('target_workflow_1');
    within(cells1[1]).getByText('bar_string');
    within(cells1[2]).getByText('String');
    within(cells1[3]).getByText('Select Source');
    within(cells1[4]).getByText(/Autofill /);
    within(cells1[4]).getByText('bar_string');
    within(cells1[4]).getByText(/ from data table/);
    within(cells1[4]).getByText('This input value is required');

    within(cells2[0]).getByText('foo');
    within(cells2[1]).getByText('foo_rating');
    within(cells2[2]).getByText('Int');
    within(cells2[3]).getByText('None');
    within(cells2[4]).getByText(/Autofill /);
    within(cells2[4]).getByText('foo_rating');
    within(cells2[4]).getByText(/ from data table/);

    within(cells3[0]).getByText('target_workflow_1');
    within(cells3[1]).getByText('not_in_table');
    within(cells3[2]).getByText('String');
    within(cells3[3]).getByText('None');
    within(cells3[4]).getByText('Optional');
  });

  it('should not display warning icon for valid lookups', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithStruct });

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    expect(rows.length).toBe(runSetInputDefWithStruct.length + 1); // one row for each input definition variable, plus headers

    const cellsFoo = within(rows[1]).getAllByRole('cell');
    expect(cellsFoo.length).toBe(5);
    within(cellsFoo[0]).getByText('foo');
    within(cellsFoo[1]).getByText('foo_rating_workflow_var');
    within(cellsFoo[2]).getByText('Int');
    within(cellsFoo[3]).getByText('Fetch from Data Table');
    // input configuration expects attribute 'foo_rating' to be present, but it isn't available in the data table.
    // Hence, the select box will be empty and defaulted to the attribute name as its placeholder,
    // but there will be a warning message next to it

    within(cellsFoo[4]).getByText('foo_rating');
    const warningMessageActive = within(cellsFoo[4]).queryByText("This attribute doesn't exist in the data table");
    expect(warningMessageActive).toBeNull();
  });

  it('should display warning icon for required inputs with missing attributes', async () => {
    setupInputTableTest({
      configuredInputDefinition: runSetInputDefWithStruct,
      selectedDataTable: typesResponseWithoutFooRating[0],
    });

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    expect(rows.length).toBe(runSetInputDefWithStruct.length + 1); // one row for each input definition variable, plus headers

    const cellsFoo = within(rows[1]).getAllByRole('cell');
    expect(cellsFoo.length).toBe(5);
    within(cellsFoo[0]).getByText('foo');
    within(cellsFoo[1]).getByText('foo_rating_workflow_var');
    within(cellsFoo[2]).getByText('Int');
    within(cellsFoo[3]).getByText('Fetch from Data Table');
    // input configuration expects attribute 'foo_rating' to be present, but it isn't available in the data table.
    // Hence, the select box will be empty and defaulted to the attribute name as its placeholder,
    // but there will be a warning message next to it

    within(cellsFoo[4]).getByText('foo_rating');
    within(cellsFoo[4]).getByText("This attribute doesn't exist in the data table");
  });

  it('should not display warning icon for valid structs using struct builder', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithCompleteStruct });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const viewStructLink = within(rows[2]).getByText('View Struct');
    const inputWarningMessageActive = within(rows[2]).queryByText('This struct is missing a required input');
    expect(inputWarningMessageActive).toBeNull();

    // ** ACT **
    await user.click(viewStructLink);

    // ** ASSERT **
    const structTable = screen.getByLabelText('struct-table');
    const structRows = within(structTable).getAllByRole('row');
    expect(structRows.length).toBe(6);

    const structCells = within(structRows[2]).getAllByRole('cell');
    within(structCells[1]).getByText('myInnerStruct');
    const viewMyInnerStructLink = within(structCells[4]).getByText('View Struct');
    const structWarningMessageActive = within(structCells[4]).queryByText('This struct is missing a required input');
    expect(structWarningMessageActive).toBeNull();

    // ** ACT **
    await user.click(viewMyInnerStructLink);

    // ** ASSERT **
    const innerStructTable = screen.getByLabelText('struct-table');
    const innerStructRows = within(innerStructTable).getAllByRole('row');
    expect(innerStructRows.length).toBe(3);

    const innerStructRow1 = within(innerStructRows[1]).getAllByRole('cell');
    within(innerStructRow1[1]).getByText('myInnermostPrimitive');
    within(innerStructRow1[4]).getByDisplayValue('2');
    const innerPrimitiveWarningMessageActive = within(innerStructRow1[4]).queryByText('This input value is required');
    expect(innerPrimitiveWarningMessageActive).toBeNull();

    const innerStructRow2 = within(innerStructRows[2]).getAllByRole('cell');
    within(innerStructRow2[1]).getByText('myInnermostRecordLookup');
    within(innerStructRow2[4]).getByText('foo_rating');
    const innerLookupWarningMessageActive = within(innerStructRow2[4]).queryByText(
      "This attribute doesn't exist in the data table"
    );
    expect(innerLookupWarningMessageActive).toBeNull();
  });

  it('should display warning icon/message at each level of the struct builder when a field has a missing attribute', async () => {
    setupInputTableTest({
      configuredInputDefinition: runSetInputDefWithStruct,
      selectedDataTable: typesResponseWithoutFooRating[0],
    });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const viewStructLink = within(rows[2]).getByText('View Struct');
    within(rows[2]).getByText('This struct is missing a required input');

    // ** ACT **
    await user.click(viewStructLink);

    // ** ASSERT **
    const structTable = screen.getByLabelText('struct-table');
    const structRows = within(structTable).getAllByRole('row');
    expect(structRows.length).toBe(6);

    const structCells = within(structRows[2]).getAllByRole('cell');
    within(structCells[1]).getByText('myInnerStruct');
    const viewMyInnerStructLink = within(structCells[4]).getByText('View Struct');
    const structWarningMessageActive = within(structCells[4]).getByText('This struct is missing a required input');
    expect(structWarningMessageActive).not.toBeNull();

    // ** ACT **
    await user.click(viewMyInnerStructLink);

    // ** ASSERT **
    const innerStructTable = screen.getByLabelText('struct-table');
    const innerStructRows = within(innerStructTable).getAllByRole('row');
    expect(innerStructRows.length).toBe(3);

    const innerStructRow1 = within(innerStructRows[1]).getAllByRole('cell');
    within(innerStructRow1[1]).getByText('myInnermostPrimitive');
    within(innerStructRow1[3]).getByText('Select Source');
    within(innerStructRow1[4]).getByText('This input value is required');

    const innerStructRow2 = within(innerStructRows[2]).getAllByRole('cell');
    within(innerStructRow2[1]).getByText('myInnermostRecordLookup');
    within(innerStructRow2[4]).getByText('foo_rating');
    within(innerStructRow2[4]).getByText("This attribute doesn't exist in the data table");
  });

  it('should display warning for inputs without source', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithSourceNone });

    // ** ASSERT **
    // check that warnings appear next to empty required inputs
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    // inputs sorted according to task name -> variable name
    const firstInputRowCells = within(rows[1]).getAllByRole('cell');
    within(firstInputRowCells[4]).getByText('This input is required');

    const thirdInputRowCells = within(rows[3]).getAllByRole('cell');
    within(thirdInputRowCells[4]).getByText('Optional');

    // struct input
    const secondInputRowCells = within(rows[2]).getAllByRole('cell');
    within(secondInputRowCells[4]).getByText('This input is required');
  });

  it('should display warning for empty required inputs', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithEmptySources });

    // ** ASSERT **
    // check that warnings appear next to empty required inputs
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    // inputs sorted according to task name -> variable name
    const firstInputRowCells = within(rows[1]).getAllByRole('cell');
    within(firstInputRowCells[4]).getByText('This input value is required');

    const thirdInputRowCells = within(rows[3]).getAllByRole('cell');
    within(thirdInputRowCells[4]).getByText('Optional');

    // struct input
    const secondInputRowCells = within(rows[2]).getAllByRole('cell');
    within(secondInputRowCells[4]).getByText('This struct is missing a required input');
  });

  it('should display warning icon for input with value not matching expected type', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithWrongTypes });

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    const firstInputRowCells = within(rows[1]).getAllByRole('cell');
    const secondInputRowCells = within(rows[2]).getAllByRole('cell');
    const thirdInputRowCells = within(rows[3]).getAllByRole('cell');

    // ** ASSERT **
    // check that the warning message for empty value is displayed
    within(firstInputRowCells[1]).getByText('empty_rating_workflow_var');
    within(firstInputRowCells[4]).getByText('Value is empty');

    // check that the warning message for incorrect value is displayed
    within(secondInputRowCells[1]).getByText('foo_rating_workflow_var');
    within(secondInputRowCells[4]).getByText("Value doesn't match expected input type");

    // check that the warning message for correct value is not displayed
    within(thirdInputRowCells[1]).getByText('bar_rating_workflow_var');
    expect(
      within(thirdInputRowCells[4]).queryByText(/Value is empty|Value doesn't match expected input type/)
    ).toBeNull();
  });

  it('should display tooltips for array literals', async () => {
    setupInputTableTest({ configuredInputDefinition: runSetInputDefWithArrayMessages });

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    const emptyIntRowCells = within(rows[1]).getAllByRole('cell');
    within(emptyIntRowCells[1]).getByText('empty_int_array');
    within(emptyIntRowCells[4]).getByText('Successfully detected an array with 0 element(s).');

    const invalidIntRowCells = within(rows[2]).getAllByRole('cell');
    within(invalidIntRowCells[1]).getByText('invalid_int_array');
    within(invalidIntRowCells[4]).getByText(
      'Array inputs should follow JSON array literal syntax. This input cannot be parsed'
    );

    const validIntRowCells = within(rows[3]).getAllByRole('cell');
    within(validIntRowCells[1]).getByText('valid_int_array');
    within(validIntRowCells[4]).getByText('Successfully detected an array with 2 element(s).');

    const stringNoSourceRowCells = within(rows[4]).getAllByRole('cell');
    within(stringNoSourceRowCells[1]).getByText('string_array_no_source');
    within(stringNoSourceRowCells[4]).getByText('This input is required');

    const emptyStringRowCells = within(rows[5]).getAllByRole('cell');
    within(emptyStringRowCells[1]).getByText('string_array_empty_source');
    within(emptyStringRowCells[4]).getByText(
      'Array inputs should follow JSON array literal syntax. This input is empty. To submit an empty array, enter []'
    );

    const singletonStringRowCells = within(rows[6]).getAllByRole('cell');
    within(singletonStringRowCells[1]).getByText('string_array_string_value');
    within(singletonStringRowCells[4]).getByText(
      'Array inputs should follow JSON array literal syntax. This will be submitted as an array with one value: "not an array"'
    );
  });
});

describe('Input table definition updates', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  });

  it('should populate fields from data table on click', async () => {
    const { setConfiguredInputDefinition } = setupInputTableTest({
      configuredInputDefinition: runSetInputDefSameInputNames,
    });
    const user = userEvent.setup();

    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const cells1 = within(rows[2]).getAllByRole('cell');

    within(cells1[4]).getByText(/Autofill /);
    const inputFillButton = within(cells1[4]).getByText('foo_rating');
    within(cells1[4]).getByText(/ from data table/);

    // fill single input from click
    await user.click(inputFillButton);

    expect(setConfiguredInputDefinition.mock.lastCall[0]).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input_name: 'target_workflow_1.foo.foo_rating',
          source: { type: 'record_lookup', record_attribute: 'foo_rating' },
        }),
      ])
    );

    const prevState = setConfiguredInputDefinition.mock.lastCall[0];

    // fill all from data table
    const fillAllButton = screen.getByText('Autofill (2) from data table');
    await user.click(fillAllButton);

    const setFn = setConfiguredInputDefinition.mock.lastCall[0];

    expect(setFn(prevState)).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input_name: 'target_workflow_1.foo.foo_rating',
          source: { type: 'record_lookup', record_attribute: 'foo_rating' },
        }),
        expect.objectContaining({
          input_name: 'target_workflow_1.bar_string',
          source: { type: 'record_lookup', record_attribute: 'bar_string' },
        }),
      ])
    );
  });

  it('should alter definition on record lookup', async () => {
    const { configuredInputDefinition, setConfiguredInputDefinition } = setupInputTableTest({
      configuredInputDefinition: runSetInputDefWithStruct,
      selectedDataTable: typesResponseWithoutFooRating[0],
    });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    const cellsFoo = within(rows[1]).getAllByRole('cell');
    expect(cellsFoo.length).toBe(5);
    within(cellsFoo[0]).getByText('foo');
    within(cellsFoo[1]).getByText('foo_rating_workflow_var');
    within(cellsFoo[2]).getByText('Int');
    within(cellsFoo[3]).getByText('Fetch from Data Table');
    within(cellsFoo[4]).getByText('foo_rating');

    // ** ACT **
    // user selects the attribute 'rating_for_foo' for input 'foo_rating_workflow_var'
    await user.click(within(cellsFoo[4]).getByText('foo_rating'));
    const selectOption = screen.getByText('rating_for_foo');
    await user.click(selectOption);

    expect(setConfiguredInputDefinition).toBeCalledWith(
      _.set('[0].source', { type: 'record_lookup', record_attribute: 'rating_for_foo' }, configuredInputDefinition)
    );
  });

  it('should alter definition on struct builder updates', async () => {
    const { configuredInputDefinition, setConfiguredInputDefinition } = setupInputTableTest({
      configuredInputDefinition: runSetInputDefWithStruct,
      selectedDataTable: typesResponseWithoutFooRating[0],
    });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const viewStructLink = within(rows[2]).getByText('View Struct');

    // ** ACT **
    await user.click(viewStructLink);

    // ** ASSERT **
    const structTable = screen.getByLabelText('struct-table');
    const structRows = within(structTable).getAllByRole('row');
    const structCells = within(structRows[2]).getAllByRole('cell');
    within(structCells[1]).getByText('myInnerStruct');
    const viewMyInnerStructLink = within(structCells[4]).getByText('View Struct');

    // ** ACT **
    await user.click(viewMyInnerStructLink);

    // ** ASSERT **
    const innerStructTable = screen.getByLabelText('struct-table');
    const innerStructRows = within(innerStructTable).getAllByRole('row');
    expect(innerStructRows.length).toBe(3);

    const innerStructCells = within(innerStructRows[2]).getAllByRole('cell');
    within(innerStructCells[1]).getByText('myInnermostRecordLookup');
    within(innerStructCells[4]).getByText('foo_rating');

    // ** ACT **
    // user selects the attribute 'rating_for_foo' for input 'foo_rating_workflow_var'
    await user.click(within(innerStructCells[4]).getByText('foo_rating'));
    const selectOption = screen.getByText('rating_for_foo');
    await user.click(selectOption);

    // ** ASSERT **
    expect(setConfiguredInputDefinition).toBeCalledWith(
      _.set(
        '[3].source.fields[4].source.fields[1].source',
        { type: 'record_lookup', record_attribute: 'rating_for_foo' },
        configuredInputDefinition
      )
    );
  });

  it('should alter definition on literal input', async () => {
    const { configuredInputDefinition, setConfiguredInputDefinition } = setupInputTableTest({
      configuredInputDefinition: runSetInputDef,
    });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    const cellsOptional = within(rows[3]).getAllByRole('cell');
    within(cellsOptional[1]).getByText('optional_var');
    within(cellsOptional[3]).getByText('Type a Value');
    const input = within(cellsOptional[4]).getByDisplayValue('Hello World');

    // ** ACT **
    // user adds exclamation point to input
    await user.type(input, '!');

    expect(setConfiguredInputDefinition).toBeCalledWith(
      _.set('[2].source', { type: 'literal', parameter_value: 'Hello World!' }, configuredInputDefinition)
    );
  });

  it('should alter definition on source to none', async () => {
    const { configuredInputDefinition, setConfiguredInputDefinition } = setupInputTableTest({
      configuredInputDefinition: runSetInputDef,
    });
    const user = userEvent.setup();

    // ** ASSERT **
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');

    const cellsOptional = within(rows[3]).getAllByRole('cell');
    within(cellsOptional[1]).getByText('optional_var');
    const selectSource = within(cellsOptional[3]).getByText('Type a Value');
    within(cellsOptional[4]).getByDisplayValue('Hello World');

    // ** ACT **
    // user selects source none for 'optional_var'
    await user.click(selectSource);
    const selectOption = screen.getByText('None');
    await user.click(selectOption);

    expect(setConfiguredInputDefinition).toBeCalledWith(
      _.set('[2].source', { type: 'none' }, configuredInputDefinition)
    );
  });
});
