const _ = require('lodash/fp')
const { checkbox, click, clickable, clickTableCell, findText, noSpinnersAfter, select } = require('../utils/integration-utils')
const { enableDataCatalog, withWorkspace } = require('../utils/integration-helpers')
const { withUserToken } = require('../utils/terra-sa-utils')


const testCatalogFlowFn = _.flow(
  withWorkspace,
  withUserToken
)(async ({ page, testUrl, token, workspaceName }) => {
  await enableDataCatalog(page, testUrl, token)
  await click(page, clickable({ textContains: 'browse & explore' }))

  await click(page, checkbox({ text: 'Granted', isDescendant: true }))
  await clickTableCell(page, 'dataset list', 2, 2)
  await noSpinnersAfter(page, { action: () => click(page, clickable({ textContains: 'Link to a workspace' })) })

  await click(page, clickable({ textContains: 'Start with an existing workspace' }))
  await select(page, 'Select a workspace', `${workspaceName}`)
  await noSpinnersAfter(page, { action: () => click(page, clickable({ text: 'Import' })) })
  await findText(page, workspaceName)
})

const testCatalog = {
  name: 'run-catalog',
  fn: testCatalogFlowFn,
  timeout: 2 * 60 * 1000,
  targetEnvironments: ['local', 'dev']
}

module.exports = { testCatalog }
