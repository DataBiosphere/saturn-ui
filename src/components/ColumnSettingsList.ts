import type {
  Announcements,
  DraggableSyntheticListeners,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TooltipTrigger } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import type { CSSProperties, PropsWithChildren } from 'react';
import { createContext, Fragment, useContext, useMemo } from 'react';
import { div, h, label, span } from 'react-hyperscript-helpers';
import { AutoSizer, List } from 'react-virtualized';
import { Checkbox } from 'src/components/common';
import { icon } from 'src/components/icons';
import * as Style from 'src/libs/style';

export interface ColumnData {
  id: UniqueIdentifier;
  name: string;
  visible: boolean;
}

export interface ColumnSettingsListProps {
  items: ColumnData[];
  onChange(items: ColumnData[]): void;
  toggleVisibility(index: number): void;
}

// Private classes related to the individual sortable item (related to a single instance of ColumnData).
interface SortableItemProps {
  id: UniqueIdentifier;
  name: string;
  index: number;
}

// To pass to the drag handle.
interface Context {
  attributes: Record<string, any>;
  listeners: DraggableSyntheticListeners;
  sortableItemProps: SortableItemProps;
  ref(node: HTMLElement | null): void;
}

const SortableItemContext = createContext<Context>({
  attributes: {},
  listeners: undefined,
  ref() {},
  sortableItemProps: {
    id: '',
    name: '',
    index: -1,
  },
});

const SortableItem = ({ children, id, name, index }: PropsWithChildren<SortableItemProps>) => {
  const { attributes, isDragging, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    // Disable because the virtualized list causes issues with animating between the original location and the destination.
    animateLayoutChanges: () => false,
    id,
  });
  const context = useMemo(
    () => ({
      attributes,
      listeners,
      ref: setActivatorNodeRef,
      sortableItemProps: {
        id,
        name,
        index,
      },
    }),
    [attributes, listeners, setActivatorNodeRef, id, name, index]
  );

  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
    display: 'flex',
  };

  return h(SortableItemContext.Provider, { value: context }, [div({ ref: setNodeRef, style }, [children])]);
};

const dragHandleId = (id) => `drag-handle-${id}`;

const DragHandle = () => {
  // attributes include aria roles to make drag and drop keyboard accessible
  // ref is setActivatorNodeRef (which may not be useful given virtualized list and our focus management)
  const { attributes, listeners, ref, sortableItemProps } = useContext(SortableItemContext);
  const { id, index, name } = sortableItemProps;

  return div(
    {
      id: dragHandleId(id),
      ref,
      ...attributes,
      ...listeners,
      style: {
        paddingRight: '0.25rem',
        cursor: 'move',
        display: 'flex',
        alignItems: 'center',
      },
      'aria-label': `Drag button for "${name}", currently at position ${index}`,
    },
    [icon('columnGrabber', { style: { transform: 'rotate(90deg)' } })]
  );
};

const rowHeight = 30;

// There are some strange visual interactions that occur, most likely related to the virtualized list.
// However, basic functionality works, and the live region updates notify screen readers of the position
// as they move items via the keyboard.
const customCoordinatesGetter = (event, args) => {
  const { currentCoordinates } = args;
  const delta = rowHeight;

  if (event.code === 'Down' || event.code === 'ArrowDown') {
    // When focus goes beyond the end of the list, funky things happen. Try to move back into the list.
    if (!args.context.over) {
      return {
        ...currentCoordinates,
        y: currentCoordinates.y - delta,
      };
    }
    return {
      ...currentCoordinates,
      y: currentCoordinates.y + delta,
    };
  }

  if (event.code === 'Up' || event.code === 'ArrowUp') {
    // When focus goes above the beginning of the list, funky things happen. Try to move back into the list.
    if (!args.context.over) {
      return {
        ...currentCoordinates,
        y: currentCoordinates.y + delta,
      };
    }
    return {
      ...currentCoordinates,
      y: currentCoordinates.y - delta,
    };
  }
  return undefined;
};

// Exported for testing purposes only.
export const dragEndNotifier = ({ active, over, items, onChange }) => {
  if (over && active.id !== over?.id) {
    const activeIndex = items.findIndex(({ id }) => id === active.id);
    const overIndex = items.findIndex(({ id }) => id === over.id);

    onChange(arrayMove(items, activeIndex, overIndex));
    // This is necessary because of the virtualized list. Without this, focus after a drag ends on up on the drag
    // handle in the row where the element was dragged from, not on the drag handle in the row it was dropped.
    // In a setTimeout so that the re-rendering has already happened.
    setTimeout(function () {
      const handle = document.getElementById(dragHandleId(active?.id));
      handle?.focus();
    });
  }
};

export const ColumnSettingsList = ({ items, onChange, toggleVisibility }: ColumnSettingsListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: customCoordinatesGetter,
      scrollBehavior: 'smooth',
      keyboardCodes: {
        start: ['Space', 'Enter'],
        cancel: ['KeyQ'], // Default is Escape, but that causes the modal to close.
        end: ['Space', 'Enter'],
      },
    })
  );

  const renderItem = (item, index) => {
    return h(SortableItem, { id: item.name, name: item.name, index: getPosition(item.id) }, [
      h(DragHandle),
      h(Fragment, [
        h(
          TooltipTrigger,
          {
            // Since attribute names don't contain spaces, word-break: break-all is necessary to
            // wrap the attribute name instead of truncating it when the tooltip reaches its
            // max width of 400px.
            content: span({ style: { wordBreak: 'break-all' } }, [item.name]),
          },
          [
            label(
              {
                style: {
                  lineHeight: `${rowHeight}px`,
                  ...Style.noWrapEllipsis,
                },
              },
              [
                h(Checkbox, {
                  'aria-label': `Show "${item.name}" in table`,
                  checked: item.visible,
                  onChange: () => toggleVisibility(index),
                }),
                ' ',
                item.name,
              ]
            ),
          ]
        ),
      ]),
    ]);
  };

  // Utilities and support related to screen reader text.
  const getPosition = (id) => _.findIndex({ id })(items) + 1;
  const getName = (id) => {
    const item = _.filter({ id })(items) as unknown;
    return item ? item[0].name : 'unknown';
  };
  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up "${getName(active.id)}". Column "${getName(active.id)}" is in position ${getPosition(
        active.id
      )} of ${items.length}.`;
    },
    onDragOver({ active, over }) {
      if (over) {
        return `"${getName(active.id)}" was moved into position ${getPosition(over.id)} of ${items.length}.`;
      }
    },
    onDragEnd({ active, over }) {
      if (over) {
        return `"${getName(active.id)}" was dropped at position ${getPosition(over.id)} of ${items.length}.`;
      }
    },
    onDragCancel({ active }) {
      return `Dragging was cancelled. "${getName(active.id)}" was dropped.`;
    },
  };
  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: `
    To begin a drag, press the space bar or Enter.
    While dragging, use the up and down arrow keys to move the item.
    Press space or Enter again to drop the item in its new position, or press the letter q to cancel.
    `,
  };

  const onDragEnd = ({ active, over }) => dragEndNotifier({ active, over, items, onChange });

  return h(AutoSizer, { disableHeight: true }, [
    ({ width }) => {
      return h(DndContext, { sensors, onDragEnd, accessibility: { announcements, screenReaderInstructions } }, [
        h(SortableContext, { items }, [
          // @ts-expect-error
          h(List, {
            lockAxis: 'y',
            width,
            height: 400,
            rowCount: items.length,
            rowHeight,
            rowRenderer: ({ index, style, key }) => {
              const item = items[index];
              return div({ key, style: { ...style, display: 'flex' }, role: 'row' }, [
                div({ role: 'gridcell' }, [renderItem(item, index)]),
              ]);
            },
          }),
        ]),
      ]);
    },
  ]);
};
