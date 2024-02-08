import { IconId, Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { CSSProperties, ReactElement, useState } from 'react';
import { div, h, strong } from 'react-hyperscript-helpers';
import { Grid } from 'react-virtualized';
import { icon } from 'src/components/icons';
import colors from 'src/libs/colors';
import { toIndexPairs } from 'src/libs/utils';

export type RowContents = {
  // The id could be generated by `wrapContent` if we can't rely on the data having an id field.
  /** The row's unique identifier. */
  id: number;
  /** If true, this row has children. */
  hasChildren: boolean;
};

export type Column<T extends RowContents> = {
  /** The column's name, displayed as a column header. */
  name: string;
  /** The column's width, in pixels. */
  width: number;
  /** Given the current row, return the column's contents. */
  render: (row: T) => string | ReactElement;
};

type RowState = 'closed' | 'opening' | 'open';

type Row<T extends RowContents> = {
  contents: T;
  depth: number;
  isFetched: boolean;
  state: RowState;
};

/**
 *  Wrap a RowContents in a Row object.
 *  @param depth the tree depth of the wrapped row
 */
const wrapContent =
  (depth: number) =>
  <T extends RowContents>(contents: T): Row<T> => ({
    contents,
    depth,
    isFetched: false,
    state: 'closed',
  });

const hierarchyMapToRows = <T extends RowContents>(hierarchyMap: Map<number, T[]>, domainOptionRoot: T): Row<T>[] => {
  const traverseHierarchy = (parent: T, depth: number, previousRows: Row<T>[]): Row<T>[] => {
    // create row with parent information
    const parentRow: Row<T> = {
      contents: parent,
      depth,
      isFetched: true,
      state: 'open',
    };

    // fetch all children of parent
    const children: T[] = hierarchyMap.get(parent.id) || [];
    // returns rows out of all children of parent
    const childRows: Row<T>[] = children.flatMap((child: T) => {
      // if child has children, recursively call traverseHierarchy to get its branch
      const childHasChildren: T[] = hierarchyMap.get(child.id) || [];
      // if child does not have children add child to Rows
      if (childHasChildren.length === 0) {
        return [
          {
            contents: child,
            depth: depth + 1,
            isFetched: false,
            state: 'closed',
          },
        ];
      }
      return traverseHierarchy(child, depth + 1, []);
    });

    // return all previousRows, append parentRow, and childRows
    return [...previousRows, parentRow, ...childRows];
  };

  // initialize rows
  const rows: Row<T>[] = [];

  // initialize depth
  const depth = 0;

  // get the children of domainOptionRoot
  const domainOptionRootChildren: T[] = hierarchyMap.get(domainOptionRoot.id) || [];

  // for each child of domainOptionRoot, traverse the hierarchy
  domainOptionRootChildren.forEach((domainOptionRootChild) => {
    rows.push(...traverseHierarchy(domainOptionRootChild, depth, []));
  });

  return rows;
};

type TreeGridProps<T extends RowContents> = {
  /** the columns to display */
  readonly columns: Column<T>[];
  /** the initial rows to display */
  readonly initialHierarchy: Map<number, T[]>;
  /** Given a row, return its children. This is only called if row.hasChildren is true. */
  readonly getChildren: (row: T) => Promise<T[]>;
  /** Given the domain option root, create a hierarchy */
  readonly domainOptionRoot: T;
  /** Optional header style */
  readonly headerStyle?: CSSProperties;
};

type TreeGridPropsInner<T extends RowContents> = TreeGridProps<T> & {
  readonly gridWidth: number;
};

/**
 * Given all rows, return the rows that are currently visible.
 */
function getVisibleRows<T extends RowContents>(allRows: Row<T>[]) {
  const visibleRows: Row<T>[] = [];
  // Root elements are always visible.
  let visibleDepth = 0;
  for (const row of allRows) {
    // A row is not visible if it's deeper than the current deepest visible row.
    if (row.depth > visibleDepth) {
      continue;
    }
    if (row.state === 'open') {
      // If a row is open, then all rows deeper than it are also visible.
      visibleDepth = row.depth + 1;
    } else {
      // If a row is closed, the visible depth is now the current row's depth.
      visibleDepth = row.depth;
    }
    visibleRows.push(row);
  }
  return visibleRows;
}

const getRowIndex = <T extends RowContents>(row: Row<T>, rows: Row<T>[]) =>
  _.findIndex((r) => r.contents.id === row.contents.id, rows);

const TreeGridInner = <T extends RowContents>(props: TreeGridPropsInner<T>) => {
  // update customWrapper to each props
  const { columns, getChildren, gridWidth, domainOptionRoot, initialHierarchy } = props;
  const [data, setData] = useState(hierarchyMapToRows(initialHierarchy, domainOptionRoot));
  const rowHeight = 40;
  const expand = async (row: Row<T>) => {
    const index = getRowIndex(row, data);
    if (row.isFetched) {
      // Children already fetched, mark as open and return.
      setData(_.set(`[${index}].state`, 'open', data));
      return;
    }
    // Mark as opening.
    setData(_.set(`[${index}].state`, 'opening', data));

    // Fetch children.
    const children = await getChildren(row.contents);

    // Mark as fetched and insert children.
    setData((currentData) => {
      const currentIndex = getRowIndex(row, currentData);
      const currentRow = currentData[currentIndex];
      const newData = _.set(`[${currentIndex}]`, { ...currentRow, state: 'open', isFetched: true }, currentData);
      newData.splice(currentIndex + 1, 0, ..._.map(wrapContent(currentRow.depth + 1), children));
      return newData;
    });
  };
  const collapse = (row: Row<T>) => {
    setData(_.set(`[${getRowIndex(row, data)}].state`, 'closed', data));
  };

  const visibleRows = getVisibleRows(data);

  return h(Grid, {
    rowHeight,
    height: rowHeight * visibleRows.length,
    rowCount: visibleRows.length,
    columnCount: columns.length,
    columnWidth: (index) => columns[index.index].width,
    width: gridWidth,
    noContentMessage: 'No matching data',
    cellRenderer: ({ rowIndex, columnIndex, style }) => {
      const row = visibleRows[rowIndex];
      const [iconName, handler, label]: [IconId, ((row: Row<T>) => void) | undefined, string | undefined] = (() => {
        switch (row.state) {
          case 'closed':
            return ['angle-up', expand, 'expand'];
          case 'open':
            return ['angle-down', collapse, 'collapse'];
          case 'opening':
          default:
            return ['loadingSpinner', undefined, undefined];
        }
      })();
      return div(
        {
          key: `${rowIndex}-${columnIndex}`,
          style: {
            ...style,
            backgroundColor: 'white',
            borderTop: rowIndex === 0 ? 0 : `.5px solid ${colors.dark(0.2)}`,
            paddingTop: 10,
            alignItems: 'center',
          },
        },
        [
          columnIndex === 0
            ? div({ style: { paddingLeft: `${1 + row.depth}rem`, display: 'flex' } }, [
                row.contents.hasChildren &&
                  (handler
                    ? h(
                        Link,
                        {
                          onClick: () => handler(row),
                          'aria-label': `${label} ${row.contents.id}`,
                          style: { paddingLeft: 5 },
                        },
                        [icon(iconName, { size: 16 })]
                      )
                    : icon(iconName, { size: 16, style: { marginLeft: 5 } })),
                div({ style: { display: 'flex', marginLeft: row.contents.hasChildren ? 10 : 5 + 16 + 10 } }, [
                  columns[columnIndex].render(row.contents),
                ]),
              ])
            : columns[columnIndex].render(row.contents),
        ]
      );
    },
    border: false,
  });
};

/**
 * A grid that displays hierarchical data in a tree-like structure.
 * <p/>
 * Width is computed as the total size of all columns. Height is
 * computed as the number of rows times the row height.
 */
export const TreeGrid = <T extends RowContents>(props: TreeGridProps<T>) => {
  const { columns, headerStyle } = props;
  const gridWidth = _.sum(_.map((c) => c.width, columns));
  return div([
    // generate a header row
    div(
      {
        style: {
          ...headerStyle,
          width: _.sum(_.map((c) => c.width, columns)),
        },
      },
      [
        _.map(
          ([index, c]) =>
            div(
              {
                key: index,
                style: { width: c.width, marginTop: 5, paddingRight: 5, paddingLeft: index === 0 ? 20 : 0 },
              },
              [strong([c.name])]
            ),
          toIndexPairs(columns)
        ),
      ]
    ),
    h(TreeGridInner<T>, { ...props, gridWidth }),
  ]);
};
