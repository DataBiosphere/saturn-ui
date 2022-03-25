import Color from 'color'
import _ from 'lodash/fp'
import { isAnvil, isBaseline, isBioDataCatalyst, isDatastage, isElwazi, isFirecloud, isTerra } from 'src/libs/config'
import * as Utils from 'src/libs/utils'


const ALL_COLORS = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'light', 'dark', 'grey']

const baseColors = {
  primary: '#4d72aa', // Used as accent on header, loading spinner, background of beta version tag and some buttons
  secondary: '#6d6e70', // Used as footer background
  accent: '#4d72aa', // Used as button backgrounds, headers, links
  success: '#74ae43',
  warning: '#f7981c',
  danger: '#db3214',
  light: '#e9ecef', // Used as header background color, lightened for background of cells, panels, etc.
  dark: '#333f52', // Used as text color, menu background (lightened), selected background (lightened)
  grey: '#808080'
}

const colorPalette = Utils.cond(
  [isFirecloud(), () => baseColors],
  [isDatastage(), () => ({ ...baseColors, primary: '#c02f42', secondary: '#1a568c', accent: '#1a568c', light: '#f4f4f6', dark: '#12385a' })],
  [isAnvil(), () => ({ ...baseColors, primary: '#e0dd10', accent: '#035c94', light: '#f6f7f4', dark: '#012840' })],
  [isBioDataCatalyst(), () => ({ ...baseColors, primary: '#c02f42', secondary: '#1a568c', accent: '#1a568c', light: '#f4f4f6', dark: '#12385a' })],
  [isBaseline(), () => ({ ...baseColors, primary: '#c41061', secondary: '#31164c', light: '#f6f7f4', dark: '#012840' })],
  [isElwazi(), () => ({ ...baseColors, primary: '#c13f27', secondary: '#c13f27', dark: '#1d1d1b', accent: '#6e3d3b', success: '#9eb642' })],
  () => ({ ...baseColors, primary: '#74ae43' })
)

const colors = _.fromPairs(_.map(
  color => [color, (intensity = 1) => Color(colorPalette[color]).mix(Color('white'), 1 - intensity).hex()],
  ALL_COLORS
))

export const terraSpecial = intensity => isTerra() ? colors.primary(intensity) : colors.accent(intensity)

export default colors
