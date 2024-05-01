import { ReactNode } from 'react';

import iconLibrary, { IconId } from './icon-library';

type SvgProps = JSX.IntrinsicElements['svg'];

export interface IconProps extends SvgProps {
  icon: IconId;
  size?: number;
}

export const Icon = (props: IconProps): ReactNode => {
  const { icon, size = 16, ...otherProps } = props || {};

  const renderIcon = iconLibrary[icon];
  return renderIcon({
    ...otherProps,
    size,
    // Unless we have a label, we need to hide the icon from screen readers
    'aria-hidden': !otherProps['aria-label'] && !otherProps['aria-labelledby'],
    'data-icon': icon,
  });
};

/**
 * Renders an icon. Prefer the {@link Icon} component in JSX.
 *
 * @param icon - The icon to render.
 * @param props - Other props for the icon component.
 */
export const icon = (icon: IconId, props?: Omit<IconProps, 'icon'>): ReactNode => {
  return <Icon icon={icon} {...props} />;
};
