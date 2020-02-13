const { testUrl } = require('../utils/integration-config')
const { withWorkspace } = require('../utils/integration-helpers')
const { click, clickable, signIntoTerra, findElement, waitForNoSpinners, select, delay, fillIn, input, findIframe, findText, dismissNotifications } = require(
  '../utils/integration-utils')


const notebookName = 'TestNoteBook'

const testRunNotebookFn = withWorkspace(async ({ page, workspaceName }) => {
  await page.goto(testUrl)
  await signIntoTerra(page)
  await dismissNotifications(page)
  await click(page, clickable({ textContains: 'View Workspaces' }))
  await findElement(page, clickable({ textContains: workspaceName }))
  await waitForNoSpinners(page)
  await click(page, clickable({ textContains: workspaceName }))
  await click(page, clickable({ text: 'notebooks' }))
  await click(page, clickable({ textContains: 'Create a' }))
  await fillIn(page, input({ placeholder: 'Enter a name' }), notebookName)
  await select(page, 'Select a language', 'Python 2')
  await click(page, clickable({ text: 'Create Notebook' }))
  await click(page, clickable({ textContains: notebookName }))
  await click(page, clickable({ textContains: 'Notebook Runtime' }))
  await select(page, 'Select Environment', 'Hail')

  try {
    await click(page, clickable({ text: 'Create' }), { timeout: 1000 }) //If no runtime exists currently
  } catch {
    await click(page, clickable({ text: 'Replace' })) //If a runtime exists already
    await click(page, clickable({ text: 'REPLACE' }))
  }

  await delay(5000) //wait for copy over or change of status
  await findElement(page, clickable({ textContains: 'Creating' }))
  await delay(300000) //creation takes about 5 minutes
  await findElement(page, clickable({ textContains: 'Running' }))
  await click(page, clickable({ text: 'Edit' }))

  const frame = await findIframe(page)
  await fillIn(frame, '//textarea', 'print(23+4)')
  await click(frame, clickable({ text: 'Run' }))
  await findText(frame, '27')
})

const testRunNotebook = {
  name: 'run notebook',
  fn: testRunNotebookFn,
  timeout: 15 * 60 * 1000

}

module.exports = { testRunNotebook }
