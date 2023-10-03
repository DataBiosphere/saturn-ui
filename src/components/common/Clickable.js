import { Interactive } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { containsUnlabelledIcon } from 'src/components/icons';
import TooltipTrigger from 'src/components/TooltipTrigger';
import { forwardRefWithName } from 'src/libs/react-utils';

export const Clickable = forwardRefWithName(
  'Clickable',
  ({ href, disabled, tagName = href ? 'a' : 'div', tooltip, tooltipSide, tooltipDelay, useTooltipAsLabel, onClick, children, ...props }, ref) => {
    const child = h(
      Interactive,
      {
        'aria-disabled': !!disabled,
        disabled,
        ref,
        onClick: (...args) => onClick && !disabled && onClick(...args),
        href: !disabled ? href : undefined,
        tabIndex: disabled ? '-1' : '0',
        tagName,
        ...props,
      },
      [children]
    );

    // To support accessibility, every link must have a label or contain text or a labeled child.
    // If an unlabeled link contains just a single unlabeled icon, then we should use the tooltip as the label,
    // rather than as the description as we otherwise would.
    //
    // If the auto-detection can't make the proper determination, for example, because the icon is wrapped in other elements,
    // you can explicitly pass in a boolean as `useTooltipAsLabel` to force the correct behavior.
    //
    // Note that TooltipTrigger does this same check with its own children, but since we'll be passing it an
    // Interactive element, we need to do the check here instead.
    const useAsLabel = _.isNil(useTooltipAsLabel) ? containsUnlabelledIcon({ children, ...props }) : useTooltipAsLabel;

    if (tooltip) {
      return h(TooltipTrigger, { content: tooltip, side: tooltipSide, delay: tooltipDelay, useTooltipAsLabel: useAsLabel }, [child]);
    }
    return child;
  }
);
