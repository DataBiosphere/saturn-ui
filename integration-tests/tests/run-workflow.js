const _ = require('lodash/fp')
const pRetry = require('p-retry')
const { checkBucketAccess, withWorkspace, createEntityInWorkspace } = require('../utils/integration-helpers')
const { click, clickable, dismissNotifications, findElement, fillIn, input, signIntoTerra, waitForNoSpinners, findInGrid, navChild, findInDataTableRow } = require('../utils/integration-utils')
const { withUserToken } = require('../utils/terra-sa-utils')


const testEntity = { name: 'test_entity_1', entityType: 'test_entity', attributes: { input: 'foo' } }
const findWorkflowButton = clickable({ textContains: 'Find a Workflow' })

const testRunWorkflowFn = _.flow(
  withWorkspace,
  withUserToken
)(async ({ billingProject, page, testUrl, token, workflowName, workspaceName }) => {
  await page.goto(testUrl)
  await signIntoTerra(page, token)
  await dismissNotifications(page)

  await createEntityInWorkspace(page, billingProject, workspaceName, testEntity)
  // Wait for bucket access to avoid sporadic failure when launching workflow.
  await checkBucketAccess(page, billingProject, workspaceName)

  await click(page, clickable({ textContains: 'View Workspaces' }))
  await waitForNoSpinners(page)
  await fillIn(page, input({ placeholder: 'SEARCH WORKSPACES' }), workspaceName)
  await click(page, clickable({ textContains: workspaceName }))

  await click(page, navChild('workflows'))
  await findElement(page, findWorkflowButton)
  await waitForNoSpinners(page)
  await click(page, findWorkflowButton)
  await click(page, clickable({ textContains: workflowName }))
  await waitForNoSpinners(page)
  await click(page, clickable({ text: 'Add to Workspace' }))
  // note that this automatically brings in the highest numbered config, which isn't what happens when going through the method repo in FC

  await waitForNoSpinners(page)
  await click(page, clickable({ text: 'Select Data' }))
  await click(page, input({ labelContains: 'Choose specific test_entitys to process' }))
  await click(page, `//*[@role="checkbox" and contains(@aria-label, "${testEntity.name}")]`)
  await click(page, clickable({ text: 'OK' }))
  await click(page, clickable({ text: 'Run analysis' }))

  // If general ajax logging is disabled, uncomment the following to debug the sporadically failing
  // checkBucketAccess call.
  // const stopLoggingPageAjaxResponses = logPageAjaxResponses(page)
  await Promise.all([
    page.waitForNavigation(),
    click(page, clickable({ text: 'Launch' }))
  ])
  // stopLoggingPageAjaxResponses()

  await pRetry(async () => {
    try {
      await findInGrid(page, 'Succeeded', { timeout: 65 * 1000 }) // long enough for the submission details to refresh
    } catch (e) {
      throw new Error(e)
    }
  }, { retries: 10, factor: 1 })

  await click(page, navChild('data'))
  await click(page, clickable({ textContains: 'test_entity' }))
  await findInDataTableRow(page, testEntity.name, testEntity.attributes.input)
})

const testRunWorkflow = {
  name: 'run-workflow',
  fn: testRunWorkflowFn,
  timeout: 15 * 60 * 1000
}

module.exports = { testRunWorkflow }
