const _ = require('lodash/fp')
const { withRegisteredUser, withBilling, withWorkspace, performAnalysisTabSetup } = require('../utils/integration-helpers')
const {
  click, clickable, getAnimatedDrawer, image, findElement, noSpinnersAfter, select, fillIn, input, findText
} = require('../utils/integration-utils')
const { registerTest } = require('../utils/jest-utils')


const notebookName = 'analysis-test-notebook'

const testCreateInteractiveAnalysisFn = _.flow(
  withWorkspace,
  withBilling,
  withRegisteredUser
)(async ({ page, token, testUrl, workspaceName }) => {
  await performAnalysisTabSetup(page, token, testUrl, workspaceName)
  await click(page, clickable({ textContains: 'Start' }))
  await findElement(page, getAnimatedDrawer('Select an application'))
  await click(page, image({ text: 'Create new notebook' }))
  await fillIn(page, input({ placeholder: 'Enter a name' }), notebookName)
  await select(page, 'Language', 'Python 3')
  await noSpinnersAfter(page, { action: () => click(page, clickable({ text: 'Create Analysis' })) })
  await findText(page, 'A cloud environment consists of application configuration, cloud compute and persistent disk(s).')
})

registerTest({
  name: 'create-interactive-analysis',
  fn: testCreateInteractiveAnalysisFn
})
