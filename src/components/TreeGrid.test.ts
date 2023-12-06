import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import _ from 'lodash/fp';
import { RowContents, TreeGrid } from 'src/components/TreeGrid';
import { renderWithAppContexts as render } from 'src/testing/test-utils';

type Node = RowContents & {
  name: string;
  children?: Node[];
};

const tree: Node = {
  name: 'root',
  id: 0,
  hasChildren: true,
  children: [
    {
      id: 1,
      hasChildren: false,
      name: 'child1',
    },
    {
      id: 2,
      hasChildren: false,
      name: 'child2',
    },
  ],
};

const col2 = (node: Node) => `${node.name}_2`;
const col3 = (node: Node) => `${node.name}_3`;

const columns = [
  { name: 'name', width: 100, render: _.get('name') },
  { name: 'col2', width: 100, render: col2 },
  { name: 'col3', width: 100, render: col3 },
];

const datasetId = '';

describe('TreeGrid', () => {
  let getChildrenCount;
  const renderTree = () => {
    getChildrenCount = 0;
    render(
      TreeGrid({
        initialRows: [tree],
        getChildren: async (_datasetId, node) => {
          getChildrenCount++;
          return node.children!;
        },
        columns,
        datasetId,
      })
    );
  };

  it('renders a tree, header and root visible, children initially hidden', () => {
    // Arrange
    renderTree();
    // Assert
    // All column names are visible in the header.
    _.map(_.flow(_.get('name'), (name) => expect(screen.queryByText(name)).toBeTruthy()))(columns);
    // The root and its columns are visible.
    expect(screen.queryByText(tree.name)).toBeTruthy();
    expect(screen.queryByText(col2(tree))).toBeTruthy();
    expect(screen.queryByText(col3(tree))).toBeTruthy();
    // The children are initially not visible.
    expect(screen.queryByText(tree.children![0].name)).toBeFalsy();
    expect(screen.queryByText(tree.children![1].name)).toBeFalsy();
  });

  it('renders a tree, children visible after expand', async () => {
    // Arrange
    renderTree();

    // Act
    const user = userEvent.setup();
    // Click the expand button.
    await user.click(screen.getByLabelText('expand'));
    // Assert
    // The children are now visible.
    expect(screen.queryByText(tree.children![0].name)).toBeTruthy();
    expect(screen.queryByText(tree.children![1].name)).toBeTruthy();
  });

  it('renders a tree, children hidden again after expand and collapse', async () => {
    // Arrange
    renderTree();

    // Act
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('expand'));
    await user.click(screen.getByLabelText('collapse'));

    // Assert
    // The children are no longer visible.
    expect(screen.queryByText(tree.children![0].name)).toBeFalsy();
    expect(screen.queryByText(tree.children![1].name)).toBeFalsy();
  });

  it('renders a tree, second call to expand uses cached values', async () => {
    // Arrange
    renderTree();

    // Act
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('expand'));
    await user.click(screen.getByLabelText('collapse'));
    await user.click(screen.getByLabelText('expand'));

    // Assert
    // Expanded twice, but only one call to getChildren.
    expect(getChildrenCount).toBe(1);
  });
});
