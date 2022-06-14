const _ = require('lodash/fp')
const { parse } = require('path')
const { createWriteStream, mkdirSync, writeFileSync } = require('fs')


module.exports = class JestReporter {
  constructor(_globalConfig, _options) {
    this.logRootDir = process.env.LOG_DIR || '/tmp/test-results'
  }

  onTestStart(test) {
    const { path } = test
    console.info(`**  Running ${parse(path).name} at ${this.timeNow()}`)
  }

  onTestResult(_testRunConfig, testResult, _runResults) {
    const { testFilePath, testResults } = testResult
    const { name } = parse(testFilePath)
    const logFileName = `${this.getLogPath(testResults)}/${name}-${Date.now()}.log`

    const writableStream = createWriteStream(logFileName)
    writableStream.on('error', ({ message }) => console.error(`Error occurred while writing Console logs to ${logFileName}.\n${message}`))

    _.forEach(({ message }) => { writableStream.write(`${message}\n`) }, testResult?.console)

    // Write pass/failure summaries
    writableStream.write('\n\nTests Summary\n')
    _.forEach(result => {
      const { title, status, failureMessages, failureDetails } = result
      writableStream.write('----------------------------------------------\n')
      writableStream.write(`Test: ${title}\n`)
      writableStream.write(`Status: ${status}\n`)
      console.log(`failureMessages: ${failureMessages}`)
      if (!_.isEmpty(failureMessages)) {
        writableStream.write(`Failure messages: ${failureMessages}\n`)
      }
      if (!_.isEmpty(failureDetails)) {
        writableStream.write(`Failure details: ${failureDetails}\n`)
      }
      writableStream.write('\n')
    }, testResults)

    writableStream.end()
    writableStream.on('finish', () => console.log(`**  Saved ${name} results: ${logFileName}`))
  }

  // Called after all tests have completed
  onRunComplete(_test, runResults) {
    // Save run summary to a file.
    const logDir = this.getLogPath(runResults)
    const summaryFile = `tests-summary.json`
    writeFileSync(`${logDir}/${summaryFile}`, JSON.stringify(runResults, null, 2))
    console.info(`**  Saved all tests summary: ${logDir}/${summaryFile}`)
    return runResults
  }

  getLogPath(result) {
    const { testResults } = result
    const hasFailure = _.some(({ status }) => status === 'failed', testResults)
    const logDir = `${this.logRootDir}/${hasFailure ? 'failures' : 'successes'}`

    // Since Node 10, mkdirSync knows to not do anything if the dir exists (https://stackoverflow.com/a/71767385/2851999) so not checking explicitly
    // We may want to specify what to do if an error occurs. Not sure if throwing is what we'd want.
    try {
      mkdirSync(logDir, { recursive: true })
    } catch (err) {
      console.error(err)
      throw err
    }

    return logDir
  }

  timeNow() {
    return new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: false
    })
  }
}
