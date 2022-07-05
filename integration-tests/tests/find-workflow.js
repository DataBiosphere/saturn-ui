const _ = require('lodash/fp')
const firecloud = require('../utils/firecloud-utils')
const { withWorkspace } = require('../utils/integration-helpers')
const { click, clickable, findElement, findText, gotoPage, signIntoTerra } = require('../utils/integration-utils')
const { registerTest } = require('../utils/jest-utils')
const { withUserToken } = require('../utils/terra-sa-utils')


const testFindWorkflowFn = _.flow(
  withWorkspace,
  withUserToken
)(async ({ billingProject, page, testUrl, token, workflowName, workspaceName }) => {
  await signIntoTerra(page, { token, testUrl })

  await click(page, clickable({ textContains: 'View Examples' }))
  await click(page, clickable({ textContains: 'code & workflows' }))
  await click(page, clickable({ textContains: workflowName }))

  await firecloud.signIntoFirecloud(page, token)
  await findText(page, workflowName)
  await findText(page, 'Synopsis') // wait for spinner overlay
  await click(page, clickable({ textContains: 'Export to Workspace...' }))
  await click(page, clickable({ textContains: `${workflowName}-configured` }))
  await click(page, clickable({ textContains: 'Use Selected Configuration' }))
  await findText(page, 'Select a workspace')
  await firecloud.selectWorkspace(page, billingProject, workspaceName)
  await click(page, clickable({ text: 'Export to Workspace' }))

  const backToTerra = async () => {
    /* This else/if is necessary to "hack" going back to localhost:3000-Terra after going to Firecloud,
     without these lines it will redirect to dev-Terra even if started out at localhost:3000-Terra */
    console.log(`testUrl: ${testUrl}`)
    if (testUrl === 'http://localhost:3000') {
      await findElement(page, clickable({ textContains: 'Yes' }))
      const yesButtonHrefDetails = (await page.$x('//a[contains(text(), "Yes")]/@href'))[0]
      const href = await page.evaluate(yesButton => yesButton.textContent, yesButtonHrefDetails)
      const redirectURL = _.replace(href,
        new RegExp('/https:\\/\\/bvdp-saturn-(dev|staging).appspot.com/ig'),
        testUrl)
      console.log(`redirectURL: ${redirectURL}`)
      await gotoPage(page, redirectURL)
    } else {
      await click(page, clickable({ textContains: 'Yes' }))
    }
    await page.waitForXPath('//*[@id="signInButton"]', { visible: true })
  }

  await Promise.all([
    page.waitForNavigation(),
    backToTerra()
  ])

  await signIntoTerra(page, { token })
  await findText(page, `${workflowName}-configured`)
  await findText(page, 'inputs')
})

registerTest({
  name: 'find-workflow',
  fn: testFindWorkflowFn
})
