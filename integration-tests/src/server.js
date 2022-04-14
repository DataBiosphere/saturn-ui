const _ = require('lodash/fp')
const express = require('express')
const { Firestore } = require('@google-cloud/firestore')
const http = require('http')
const { promiseHandler, Response, withAuth, withPuppeteer } = require('./utils')
const { testFindWorkflow } = require('integration-tests/tests/batch-workflows/find-workflow')
const { testImportCohortData } = require('integration-tests/tests/workspaces/import-cohort-data')
const { testImportDockstoreWorkflow } = require('integration-tests/tests/batch-workflows/import-dockstore-workflow')
const { testRegisterUser } = require('integration-tests/tests/workspaces/register-user')
const { testRunNotebook } = require('integration-tests/tests/interactive-analysis/run-notebook')
const { testCreateInteractiveAnalysis } = require('integration-tests/tests/interactive-analysis/create-interactive-analysis')
const { testAnalysisContextBar } = require('integration-tests/tests/interactive-analysis/analysis-context-bar')
const { testRunWorkflow } = require('integration-tests/tests/batch-workflows/run-workflow')
const { testRunWorkflowOnSnapshot } = require('integration-tests/tests/workspaces/run-workflow-on-snapshot')
const { defaultTimeout } = require('../utils/integration-helpers')
const { delay, withScreenshot } = require('../utils/integration-utils')
const envs = require('../utils/terra-envs')


// Sane-ish max runtime for a test (20 minutes plus an extra minute for tear-down). Mainly to extend the default 2-minute timeout.
const serverTimeout = 21 * 60 * 1000

const app = express()
const server = http.createServer(app)
server.setTimeout(serverTimeout)

const firestore = new Firestore()

const testTimeout = async timeout => {
  await delay(timeout)
  throw new Error(`Test timeout after ${timeout}ms`)
}


const runTest = fn => withPuppeteer(async ({ browser, context, name, page, req, timeout }) => {
  const targetEnvParams = { ...envs[req.query.targetEnv] }
  const testGroup = req.query.testGroup
  const startTime = new Date()
  const host = req.headers.host
  if (testGroup === undefined) {
    throw new Error('Must provide a test group to record test results')
  }
  const reportTest = async error => {
    const endTime = new Date()
    const testReport = { testGroup, runtimeInMilliseconds: endTime - startTime, status: error ? 'error' : 'success', testName: name, error, host, startTime, endTime }
    await firestore.collection('tests').doc().create(testReport)
  }
  if (host === 'terra-bueller.appspot.com') {
    throw new Error('Do not call without a version specified')
  }
  try {
    const test = withScreenshot(name, fn)
    const result = await Promise.race([
      test({ browser, context, page, ...targetEnvParams }),
      testTimeout(timeout)
    ])
    await reportTest(null)
    return new Response(200, result)
  } catch (e) {
    const error = {
      name: e.name,
      message: e.message,
      stack: e.stack
    }
    await reportTest(error)
    return new Response(200, error)
  }
})

const registerTestEndpoint = ({ fn, name, timeout = defaultTimeout }) => {
  if (timeout > serverTimeout) {
    console.warn(`${name}: timeout of ${timeout} is greater than the server timeout of ${serverTimeout}`)
  }
  const path = `/test/${name}`
  console.info(`=> ${path}`)
  app.post(path, promiseHandler(withAuth(async req => await runTest(fn)({ name, req, timeout }))))
}

_.forEach(registerTestEndpoint, [
  testAnalysisContextBar,
  testCreateInteractiveAnalysis,
  testFindWorkflow,
  testImportCohortData,
  testImportDockstoreWorkflow,
  testRegisterUser,
  testRunNotebook,
  testRunWorkflow,
  testRunWorkflowOnSnapshot
])
console.info('Ready')

server.listen(process.env.PORT || 8080)
