const { checkbox, click, clickable, findText, waitForNoSpinners, getTableCellPath, findTableTextWithinColumn } = require('../utils/integration-utils')
const { enableDataCatalog } = require('../utils/integration-helpers')
const { withUserToken } = require('../utils/terra-sa-utils')


const datasetName = 'Readable Catalog Snapshot 1'

const testPreviewDatasetFn = withUserToken(async ({ testUrl, page, token }) => {
  await enableDataCatalog(page, testUrl, token)
  await click(page, clickable({ textContains: 'browse & explore' }))
  await waitForNoSpinners(page)
  await click(page, checkbox({ text: 'Granted', isDescendant: true }))
  await click(page, clickable({ textContains: `${datasetName}` }))
  await waitForNoSpinners(page)
  await findText(page, 'Contributors')
  await click(page, clickable({ textContains: 'Preview data' }))
  await waitForNoSpinners(page)

  const tableName = 'Participant Preview Data'
  await findTableTextWithinColumn(page, { tableName, columnHeader: 'participant_id', textContains: 'participant1' })
  await findTableTextWithinColumn(page, { tableName, columnHeader: 'biological_sex', textContains: 'male' })
  await getTableCellPath(page, { row: 2 , column: getTableColIndex(page, {tableName, columnHeader: 'age' }) })
  await findTableTextWithinColumn(page, { tableName, columnHeader: 'age', textContains: '36' })
})

const testPreviewDataset = {
  name: 'preview-dataset',
  fn: testPreviewDatasetFn,
  timeout: 2 * 60 * 1000,
  targetEnvironments: ['local', 'dev']
}

module.exports = { testPreviewDataset }
