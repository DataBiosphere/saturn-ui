import { fetchOk } from 'src/libs/ajax/fetch/fetch-core';
import { asMockedFn } from 'src/testing/test-utils';

import { fetchDockstore } from './ajax-common';
import { Dockstore } from './Dockstore';

type AjaxCommonExports = typeof import('./ajax-common');
jest.mock('./ajax-common', (): Partial<AjaxCommonExports> => {
  return {
    fetchDockstore: jest.fn(),
  };
});

type FetchCoreExports = typeof import('src/libs/ajax/fetch/fetch-core');
jest.mock('src/libs/ajax/fetch/fetch-core', (): Partial<FetchCoreExports> => {
  return {
    fetchOk: jest.fn(),
  };
});

describe('Dockstore', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  const testWorkflowPath = 'github.com/DataBiosphere/test-workflows/test-workflow';
  const testWorkflowVersion = 'v1.0.0';

  describe('getWdl', () => {
    beforeEach(() => {
      // Arrange
      asMockedFn(fetchDockstore).mockResolvedValue(
        new Response(
          JSON.stringify({
            descriptor: 'Test workflow',
            type: 'WDL',
            url: 'https://raw.githubusercontent.com/DataBiosphere/test-workflows/v1.0.0/test-workflow.wdl',
          })
        )
      );

      asMockedFn(fetchOk).mockResolvedValue(new Response('workflow TestWorkflow {}'));
    });

    it('fetches WDL descriptor from Dockstore', async () => {
      // Act
      await Dockstore().getWdl({ path: testWorkflowPath, isTool: false, version: testWorkflowVersion });

      // Assert
      expect(fetchDockstore).toHaveBeenCalledWith(
        `api/ga4gh/v1/tools/%23workflow%2F${encodeURIComponent(testWorkflowPath)}/versions/${encodeURIComponent(
          testWorkflowVersion
        )}/WDL/descriptor`,
        { signal: undefined }
      );
    });

    it('fetches WDL code', async () => {
      // Act
      const wdl = await Dockstore().getWdl({ path: testWorkflowPath, isTool: false, version: testWorkflowVersion });

      // Assert
      expect(fetchOk).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/DataBiosphere/test-workflows/v1.0.0/test-workflow.wdl',
        { signal: undefined }
      );

      expect(wdl).toBe('workflow TestWorkflow {}');
    });
  });

  describe('listVersions', () => {
    it('fetches workflow versions', async () => {
      // Arrange
      asMockedFn(fetchDockstore).mockResolvedValue(new Response('[]'));

      // Act
      const versions = await Dockstore().getVersions({ path: testWorkflowPath, isTool: false });

      // Assert
      expect(fetchDockstore).toHaveBeenCalledWith(
        `api/ga4gh/v1/tools/%23workflow%2F${encodeURIComponent(testWorkflowPath)}/versions`,
        { signal: undefined }
      );

      expect(versions).toEqual([]);
    });
  });
});
