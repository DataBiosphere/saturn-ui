import _ from 'lodash/fp'
import { loadedConfigStore } from 'src/configStore'
import { configOverridesStore } from 'src/libs/state'


export const getConfig = () => {
  console.assert(loadedConfigStore.current, 'Called getConfig before initialization')
  return _.merge(loadedConfigStore.current, configOverridesStore.get())
}

export const isAnvil = () => (window.location.hostname === 'anvil.terra.bio') || getConfig().isAnvil
export const isAnalysisTabVisible = () => getConfig().isAnalysisTabVisible
export const isDataBrowserVisible = () => getConfig().isDataBrowserVisible
export const isBaseline = () => (window.location.hostname === 'baseline.terra.bio') || getConfig().isBaseline
export const isBioDataCatalyst = () => (window.location.hostname.endsWith('.biodatacatalyst.nhlbi.nih.gov')) || getConfig().isBioDataCatalyst
export const isDatastage = () => (window.location.hostname === 'datastage.terra.bio') || getConfig().isDatastage
export const isFirecloud = () => (window.location.hostname === 'firecloud.terra.bio') || getConfig().isFirecloud
export const isTerra = () => !isFirecloud() && !isDatastage() && !isAnvil() && !isBioDataCatalyst() && !isUKBiobank() && !isBaseline()
export const isUKBiobank = () => (window.location.hostname === 'ukbiobank.terra.bio') || getConfig().isUKBiobank
