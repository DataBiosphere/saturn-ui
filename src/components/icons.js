import _ from 'lodash/fp'
import { Children } from 'react'
import { div, img } from 'react-hyperscript-helpers'
import { getUser } from 'src/libs/auth'
import colors from 'src/libs/colors'
import iconDict from 'src/libs/icon-dict'


/**
 * To support accessibility, every icon must be labeled, either:
 * * by placing it next to relevant text and hiding the icon, or
 * * by explicitly setting `aria-label` or `aria-labelledby` on the icon or its interactive container element.
 *
 * This function attempts to determine if an element with the given set of children and properties
 * contains a single icon without a label, so we can do an appropriate resolution.
 *
 * If the container element has an 'aria-label` or `aria-labelledby`, or if the icon itself
 * has `aria-label` or `aria-labelledby`, or if the icon is accompanied by other child elements, then we can
 * assume the icon is labeled and no further label is needed.
 */
export const containsUnlabelledIcon = ({ children, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy }) => {
  if (!ariaLabel && !ariaLabelledBy && Children.count(children) === 1 && typeof children !== 'string') {
    try {
      const onlyChild = Children.only(children)

      // Is there a better way to test for an icon component other than duck-typing?
      if ('data-icon' in onlyChild.props && onlyChild.props['aria-hidden'] === true) {
        return true
      }
    } catch (e) { /* do nothing */ }
  }
  return false
}

/**
 * Creates an icon: FA or custom.
 * @param {string} shape - see {@link https://fontawesome.com/icons?d=gallery}
 * @param {object} [props]
 * @param {number} [props.size] The size of the icon
 * @param {string} [props.aria-label] An optional accessible label to apply to the icon.
 *    If not specified 'aria-hidden' will be set to true.
 */
export const icon = (shape, { size = 16, ...props } = {}) => {
  // Unless we have a label, we need to hide the icon from screen readers
  props['aria-hidden'] = !props['aria-label'] && !props['aria-labelledby']

  return _.invokeArgs(shape, [{ size, 'data-icon': shape, ...props }], iconDict)
}

export const spinner = props => icon('loadingSpinner', _.merge({ size: 24, style: { color: colors.primary() } }, props))

export const centeredSpinner = ({ size = 48, ...props } = {}) => spinner(_.merge({
  size, style: {
    display: 'block',
    position: 'sticky',
    top: `calc(50% - ${size / 2}px)`,
    bottom: `calc(50% - ${size / 2}px)`,
    left: `calc(50% - ${size / 2}px)`,
    right: `calc(50% - ${size / 2}px)`
  }
}, props))

export const profilePic = ({ size, style, ...props } = {}) => {
  // Note Azure logins don't currently have an imageUrl.
  // For now, don't render anything. In the future, investigate auto-generating a
  // picture in the UI or adding this capability to B2C.
  const imageUrl = getUser().imageUrl
  return imageUrl && img({
    alt: 'Google profile image',
    src: imageUrl,
    height: size, width: size,
    style: { borderRadius: '100%', ...style },
    referrerPolicy: 'no-referrer',
    ...props
  })
}

export const wdlIcon = ({ style = {}, ...props } = {}) => div({
  style: {
    color: 'white', fontSize: 6, fontWeight: 'bold',
    backgroundColor: colors.dark(),
    padding: '10px 2px 3px 2px',
    ...style
  },
  ...props
}, ['WDL'])
