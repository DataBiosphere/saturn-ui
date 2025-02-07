const pRetry = require('p-retry');
const { click, clickable, findInGrid } = require('./integration-utils');

const launchWorkflowAndWaitForSuccess = async (page) => {
  await click(page, clickable({ text: 'Launch' }));
  // If general ajax logging is disabled, uncomment the following to debug the sporadically failing
  // checkBucketAccess call.
  // const stopLoggingPageAjaxResponses = logPageAjaxResponses(page)
  await Promise.all([page.waitForNavigation(), click(page, clickable({ text: 'Launch' }))]);
  // stopLoggingPageAjaxResponses()

  // If this table doesn't exists, something is wrong. Fail test now.
  await page.waitForSelector('xpath///*[@role="table" and @aria-label="submission details"]', { visible: true });

  // Workflow status list:
  // Queued -> Submitted -> Launching -> Running -> Succeeded or Failed
  const start = Date.now();

  // Long enough for the submission details to be Running or Failed.
  // Workflows might sit in "Submitted" for a long time if there is a large backlog of workflows in the environment
  const workflowStatus = await Promise.race([
    findInGrid(page, 'Succeeded', { timeout: 5 * 60 * 1000 }).then(() => 'Succeeded'),
    findInGrid(page, 'Failed', { timeout: 5 * 60 * 1000 }).then(() => 'Failed'),
    findInGrid(page, 'Running', { timeout: 5 * 60 * 1000 }).then(() => 'Running'),
  ]);

  if (workflowStatus === 'Succeeded') {
    return;
  }

  // If status is not Running, fails test now
  if (workflowStatus === 'Failed') {
    throw new Error('Workflow has failed');
  }

  // Wait until status is Succeeded or Failed
  const workflowHasSucceeded = await pRetry(
    async () => {
      try {
        return await Promise.race([
          findInGrid(page, 'Succeeded', { timeout: 60 * 1000 }).then(() => true),
          findInGrid(page, 'Failed', { timeout: 60 * 1000 }).then(() => false),
        ]);
      } catch (e) {
        console.info(`Workflow is running, elapsed time (minutes): ${((Date.now() - start) / (1000 * 60)).toFixed(2)}`);
        throw new Error(e);
      }
    },
    {
      onFailedAttempt: (error) => {
        console.log(`There are ${error.retriesLeft} retries left.`);
      },
      retries: 15,
      factor: 1,
    }
  );

  // pRetry will complete successfully when either Failed or Succeeded status is found.
  // We need to check status here to see if workflow has succeeded or not.
  if (!workflowHasSucceeded) {
    throw new Error('Workflow has failed');
  }
};

module.exports = { launchWorkflowAndWaitForSuccess };
