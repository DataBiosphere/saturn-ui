const _ = require('lodash/fp');
const { withWorkspace, createEntityInWorkspace } = require('../utils/integration-helpers');
const { registerTest } = require('../utils/jest-utils');
const { withUserToken } = require('../utils/terra-sa-utils');
const {
  Millis,
  findText,
  navChild,
  fillIn,
  click,
  clickable,
  elementInDataTableRow,
  waitForNoSpinners,
  input,
  signIntoTerra,
} = require('../utils/integration-utils');

const testPreviewDrsUriFn = _.flow(
  withWorkspace,
  withUserToken
)(async ({ billingProject, page, testUrl, token, workspaceName }) => {
  const testEntity = {
    name: 'test_entity_1',
    entityType: 'test_entity',
    attributes: {
      file_uri: 'drs://jade.datarepo-dev.broadinstitute.org/v1_0c86170e-312d-4b39-a0a4-2a2bfaa24c7a_c0e40912-8b14-43f6-9a2f-b278144d0060',
    },
  };

  console.log('signing in...');
  await signIntoTerra(page, { token, testUrl });

  console.log('creating entity...');
  await createEntityInWorkspace(page, billingProject, workspaceName, testEntity);

  console.log('listing workspaces...');
  await click(page, clickable({ textContains: 'View Workspaces' }));
  await waitForNoSpinners(page);

  console.log('opening test workspace...');
  await fillIn(page, input({ placeholder: 'Search by name, project, or bucket' }), workspaceName);
  await click(page, clickable({ textContains: workspaceName }), { timeout: Millis.ofMinute });
  await findText(page, 'About the workspace');

  // Wait for the "test_entity" link to appear.
  // Loading the workspace page now means we need to make a Google API call to
  // fetch the GCS bucket location, which takes a while; we don't need to wait for
  // all spinners to disapper.
  console.log('opening Data tab...');
  await click(page, navChild('data'));
  await findText(page, `${testEntity.entityType}`);

  console.log('opening data table...');
  await click(page, clickable({ textContains: testEntity.entityType }));
  console.log('opening preview for entity...');
  await click(page, elementInDataTableRow(testEntity.name, testEntity.attributes.file_uri));
  console.log('verifying text in preview modal...');
  await findText(page, 'Filename');
  await findText(page, 'File size');
});

registerTest({
  name: 'preview-drs-uri',
  fn: testPreviewDrsUriFn,
});
