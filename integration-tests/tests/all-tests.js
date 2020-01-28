const { withScreenshot } = require('../utils/integration-helpers')
const { testFindWorkflow } = require('./find-workflow.integration-test')
const { testImportCohortData } = require('./import-cohort-data.integration-test')
const { testImportDockstoreWorkflow } = require('./import-dockstore-workflow.integration-test')
const { testRegisterUser } = require('./register-user.integration-test')
const { testRunWorkflow } = require('./run-workflow.integration-test')


const defaultTimeout = 5 * 60 * 1000

const withGlobalJestPuppeteerContext = test => async () => await test({ context, page: await context.newPage() })

const registerTest = ({ name, fn, timeout = defaultTimeout }) => test.concurrent(name, withGlobalJestPuppeteerContext(withScreenshot(name, fn)), timeout)

registerTest(testFindWorkflow)
registerTest(testImportCohortData)
registerTest(testImportDockstoreWorkflow)
registerTest(testRegisterUser)
registerTest(testRunWorkflow)
