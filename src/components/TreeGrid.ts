import { IconId, Link } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { CSSProperties, ReactElement, useRef, useState } from 'react';
import { div, h, strong } from 'react-hyperscript-helpers';
import { AutoSizer, Grid } from 'react-virtualized';
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

/** A parent node in a pre-initialized tree. Each parent node contains its id and a list of its children. */
export type Parent<T extends RowContents> = {
  readonly parentId: number;
  readonly children: T[];
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

export const populateTree = <T extends RowContents>(root: T, parents: Parent<T>[]): Row<T>[] => {
  const createRows = (parent: T, depth: number, previousRows: Row<T>[]): Row<T>[] => {
    // does parent have children?
    const children = _.find({ parentId: parent.id }, parents)?.children ?? [];
    const parentRow: Row<T> = {
      contents: parent,
      depth,
      isFetched: children.length > 0,
      state: children.length > 0 ? 'open' : 'closed',
    };
    // For each child, generate its rows. Add the generated rows to the end.
    const childRows = children.flatMap((child) => createRows(child as T, depth + 1, []));
    return [...previousRows, parentRow, ...childRows];
  };

  // To hide the root, call tail() and use a depth of -1, so the root's children are at depth 0.
  return _.tail(createRows(root, -1, []));
};

type TreeGridProps<T extends RowContents> = {
  /** the columns to display */
  readonly columns: Column<T>[];
  /** The root of the tree to display. Note that the root node is hidden, and only its children are shown. */
  readonly root: T;
  /** For a pre-initialized tree, all the known parent nodes. */
  readonly parents?: Parent<T>[];
  /** Given a row, return its children. This is only called if row.hasChildren is true. */
  readonly getChildren: (row: T) => Promise<T[]>;
  /** Optional header style */
  readonly headerStyle?: CSSProperties;
  /** Optional opened concept ID for determining initial row */
  readonly openedConceptId?: number;
};

type TreeGridPropsInner<T extends RowContents> = TreeGridProps<T> & {
  readonly gridWidth: number;
  readonly height: number;
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
  const { columns, getChildren, gridWidth, height, root, parents } = props;
  const [data, setData] = useState(populateTree(root, parents ?? []));
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const treeGrid = useRef<Grid>();

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

  const rowsShowing = height ? height / rowHeight : 0;
  // We want to place the selected concept in the middle of the visible rows, so we scroll to the element plus half the rows showing
  const initialRow =
    _.findIndex((row) => row.contents.id === props.openedConceptId, visibleRows) + _.floor(rowsShowing / 2);

  return h(Grid, {
    ref: treeGrid,
    rowHeight,
    height,
    rowCount: visibleRows.length,
    columnCount: columns.length,
    columnWidth: (index) =>
      index.index === columns.length - 1 ? columns[index.index].width - scrollbarSize : columns[index.index].width,
    onScrollbarPresenceChange: (args) => {
      setScrollbarSize(args.vertical ? args.size : 0);
      treeGrid?.current?.recomputeGridSize();
    },
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
    // Clamp lets us place the first occurrence of the selected concept in the middle of the grid
    scrollToRow: _.clamp(0, visibleRows.length - 1, initialRow),
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
  return h(AutoSizer, { disableWidth: true }, [
    ({ height }) => {
      const headerHeight = 60;
      // generate a header row
      return div({ style: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' } }, [
        div(
          {
            style: {
              ...headerStyle,
              height: headerHeight,
              width: gridWidth,
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
        div({ style: { flex: 1 } }, [h(TreeGridInner<T>, { ...props, gridWidth, height: height - headerHeight })]),
      ]);
    },
  ]);
};
