// This test is owned by the Interactive Analysis (IA) Team.
const _ = require('lodash/fp')
const { withRegisteredUser, withBilling, withWorkspace, performAnalysisTabSetup } = require('../utils/integration-helpers')
const {
  click, clickable, delay, findElement, noSpinnersAfter, fillIn, findIframe, findText, dismissNotifications, select, getAnimatedDrawer, image, input
} = require('../utils/integration-utils')
const { registerTest } = require('../utils/jest-utils')


const notebookName = 'test-notebook'

const testRunAnalysisFn = _.flow(
  withWorkspace,
  withBilling,
  withRegisteredUser
)(async ({ workspaceName, page, testUrl, token }) => {
  await performAnalysisTabSetup(page, token, testUrl, workspaceName)

  // Create analysis file
  await click(page, clickable({ textContains: 'Start' }))
  await findElement(page, getAnimatedDrawer('Select an application'))
  await click(page, image({ text: 'Create new notebook' }))
  await fillIn(page, input({ placeholder: 'Enter a name' }), notebookName)
  await select(page, 'Language', 'Python 3')
  await noSpinnersAfter(page, { action: () => click(page, clickable({ text: 'Create Analysis' })) })

  // Close the create cloud env modal that pops up
  await noSpinnersAfter(page, {
    action: () => findText(page, 'A cloud environment consists of application configuration, cloud compute and persistent disk(s).')
  })


  await click(page, clickable({ textContains: 'Close' }))

  //The Compute Modal does not close quickly enough, so the subsequent click does not properly click on the element
  await delay(3000)

  // Navigate to analysis launcher
  await findElement(page, clickable({ textContains: notebookName }))
  await click(page, clickable({ textContains: notebookName }))
  await dismissNotifications(page)

  await noSpinnersAfter(page, {
    action: () => click(page, clickable({ textContains: 'Open' }))
  })

  //Create a cloud env from analysis launcher
  await click(page, clickable({ text: 'Create' }))

  //The Compute Modal does not close quickly enough, so the subsequent click does not properly click on the element
  await delay(3000)

  await findElement(page, clickable({ textContains: 'Jupyter Environment' }), { timeout: 40000 })
  await findElement(page, clickable({ textContains: 'Creating' }), { timeout: 40000 })
  await click(page, clickable({ textContains: 'Open' }))

  // Wait for the environment to be running
  await findText(page, 'Creating cloud environment')
  await findElement(page, clickable({ textContains: 'Jupyter Environment' }), { timeout: 10 * 60000 })
  await findElement(page, clickable({ textContains: 'Running' }), { timeout: 10 * 60000 })

  // Find the iframe, wait until the Jupyter kernel is ready, and execute some code
  const frame = await findIframe(page, '//iframe[@id="analysis-iframe"]')

  await findElement(frame, '//*[@title="Kernel Idle"]', { timeout: 60000 })
  await fillIn(frame, '//textarea', 'print(123456789099876543210990+9876543219)')
  await click(frame, clickable({ text: 'Run' }))
  await findText(frame, '123456789099886419754209')

  // Save notebook to avoid "unsaved changes" modal when test tear-down tries to close the window
  await click(frame, clickable({ text: 'Save and Checkpoint' }))
})

registerTest({
  name: 'run-analysis',
  fn: testRunAnalysisFn,
  timeout: 20 * 60 * 1000,
  targetEnvironments: ['dev']
})
