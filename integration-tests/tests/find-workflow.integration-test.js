const firecloud = require('../utils/firecloud-utils')
const { billingProject, testUrl, workflowName } = require('../utils/integration-config')
const { withWorkspace } = require('../utils/integration-helpers')
const { click, clickable, findText, signIntoTerra, waitForElement } = require('../utils/integration-utils')


test('find workflow', withWorkspace(async ({ workspaceName }) => {
  await page.goto(testUrl)
  await signIntoTerra(page)
  await click(page, clickable({ textContains: 'View Examples' }))
  await click(page, clickable({ textContains: 'code & workflows' }))
  await click(page, clickable({ textContains: workflowName }))

  await firecloud.signIntoFirecloud(page)
  await findText(page, workflowName)
  await click(page, clickable({ textContains: 'Export to Workspace...' }))
  await click(page, clickable({ textContains: `${workflowName}-configured` }))
  await click(page, clickable({ textContains: 'Use Selected Configuration' }))
  await findText(page, 'Select a workspace')
  await firecloud.selectWorkspace(page, billingProject, workspaceName)
  await click(page, clickable({ text: 'Export to Workspace' }))

  /* This else/if is necessary to "hack" going back to localhost:3000-Terra after going to Firecloud,
   without these lines it will redirect to dev-Terra even if started out at localhost:3000-Terra */
  if (testUrl === 'http://localhost:3000') {
    await waitForElement(page, clickable({ textContains: 'Yes' }))
    const yesButtonHrefDetails = (await page.$x('//a[contains(text(), "Yes")]/@href'))[0]
    const redirectURL = (await page.evaluate(yesButton => yesButton.textContent, yesButtonHrefDetails)).replace(
      'https://bvdp-saturn-dev.appspot.com',
      testUrl)
    await page.goto(redirectURL)
  } else {
    await click(page, clickable({ textContains: 'Yes' }))
  }

  await signIntoTerra(page)
  await findText(page, `${workflowName}-configured`)
  await findText(page, 'inputs')
}), 5 * 60 * 1000)
