const { checkbox, click, clickable, clickTableCell, findText, waitForNoSpinners } = require('../utils/integration-utils')
const { enableDataCatalog } = require('../utils/integration-helpers')
const { withUserToken } = require('../utils/terra-sa-utils')


const testRequestAccessFn = withUserToken(async ({ testUrl, page, token }) => {
  await enableDataCatalog(page, testUrl, token)
  await click(page, clickable({ textContains: 'datasets' }))
  await click(page, clickable({ textContains: 'BETA Data Catalog OFF' }))
  await waitForNoSpinners(page)
  await click(page, checkbox({ text: 'Controlled', isDescendant: true }))

  // Request access from the browse & explore page
  await click(page, clickable({ textContains: 'Request Access' }))
  await findText(page, 'Request Access')
  await click(page, clickable({ textContains: 'Close modal' }))

  // Request access from the dataset details page
  await clickTableCell(page, { tableName: 'dataset list', columnHeader: 'Dataset Name', textContains: 'Discoverable Catalog Snapshot 1' })
  await waitForNoSpinners(page)
  await click(page, clickable({ textContains: 'Request Access' }))
  await findText(page, 'Request Access')
})

const testRequestAccess = {
  name: 'request-access',
  fn: testRequestAccessFn,
  timeout: 2 * 60 * 1000, // 2 min timeout
  targetEnvironments: ['local', 'dev']
}

module.exports = { testRequestAccess }
