import { AppAjaxContract, Apps, AppsAjaxContract } from 'src/libs/ajax/leonardo/Apps';
import { asMockedFn, partial } from 'src/testing/test-utils';
import { defaultAzureWorkspace } from 'src/testing/workspace-fixtures';

import { AppBasics, leoAppProvider } from './LeoAppProvider';

jest.mock('src/libs/ajax/leonardo/Apps');

type AppNeeds = Pick<AppAjaxContract, 'delete' | 'pause' | 'details'>;
type AppsNeeds = Pick<AppsAjaxContract, 'app' | 'listWithoutProject' | 'deleteAppV2' | 'getAppV2'>;

interface AjaxMockNeeds {
  Apps: AppsNeeds;
  app: AppNeeds;
}
/**
 * local test utility - sets up mocks for needed ajax data-calls with as much type-saftely as possible.
 *
 * @return collection of key data-call fns for easy
 * mock overrides and/or method spying/assertions
 */
const mockAjaxNeeds = (): AjaxMockNeeds => {
  const partialApp: AppNeeds = {
    delete: jest.fn(),
    pause: jest.fn(),
    details: jest.fn(),
  };

  const partialApps: AppsNeeds = {
    app: jest.fn(() => partial<AppAjaxContract>(partialApp)),
    listWithoutProject: jest.fn(),
    deleteAppV2: jest.fn(),
    getAppV2: jest.fn(),
  };

  asMockedFn(Apps).mockReturnValue(partial<AppsAjaxContract>(partialApps));

  return {
    Apps: partialApps,
    app: partialApp,
  };
};
describe('leoAppProvider', () => {
  describe('GCP', () => {
    it('handles list call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      asMockedFn(ajaxMock.Apps.listWithoutProject).mockResolvedValue([]);
      const signal = new window.AbortController().signal;

      // Act
      const result = await leoAppProvider.listWithoutProject({ arg: '1' }, { signal });

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(signal);
      expect(ajaxMock.Apps.listWithoutProject).toBeCalledTimes(1);
      expect(ajaxMock.Apps.listWithoutProject).toBeCalledWith({ arg: '1' });
      expect(result).toEqual([]);
    });

    it('handles pause app call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'GCP',
          cloudResource: 'myGoogleProject',
        },
        workspaceId: null,
      };

      // Act
      // calls to this method generally don't care about passing in signal, but doing it here for completeness
      void (await leoAppProvider.pause(app, { signal: abort.signal }));

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(abort.signal);
      expect(ajaxMock.Apps.app).toBeCalledTimes(1);
      expect(ajaxMock.Apps.app).toBeCalledWith('myGoogleProject', 'myAppName');
      expect(ajaxMock.app.pause).toBeCalledTimes(1);
    });

    it('handles delete app call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'GCP',
          cloudResource: 'myGoogleProject',
        },
        workspaceId: null,
      };

      // Act
      // calls to this method generally don't care about passing in signal, but doing it here for completeness
      void (await leoAppProvider.delete(app, { signal: abort.signal }));

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(abort.signal);
      expect(ajaxMock.Apps.app).toBeCalledTimes(1);
      expect(ajaxMock.Apps.app).toBeCalledWith('myGoogleProject', 'myAppName');
      expect(ajaxMock.app.delete).toBeCalledTimes(1);
      expect(ajaxMock.app.delete).toBeCalledWith(false);
    });

    it('handles get app call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'GCP',
          cloudResource: 'myGoogleProject',
        },
        workspaceId: null,
      };

      // Act
      // calls to this method generally don't care about passing in signal, but doing it here for completeness
      void (await leoAppProvider.get(app, { signal: abort.signal }));

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(abort.signal);
      expect(ajaxMock.Apps.app).toBeCalledTimes(1);
      expect(ajaxMock.Apps.app).toBeCalledWith('myGoogleProject', 'myAppName');
      expect(ajaxMock.app.details).toBeCalledTimes(1);
    });
  });

  describe('Azure', () => {
    it('does not support pause app call', async () => {
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: defaultAzureWorkspace.workspace.workspaceId,
      };

      // Act
      // calls to this method generally don't care about passing in signal, but doing it here for completeness
      const shouldThrow = async () => {
        await leoAppProvider.pause(app, { signal: abort.signal });
      };

      // Assert
      await expect(shouldThrow()).rejects.toEqual(new Error('Pausing apps is not supported for azure'));
      expect(Apps).toBeCalledTimes(0);
    });

    it('handles delete app call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: defaultAzureWorkspace.workspace.workspaceId,
      };

      // Act
      void (await leoAppProvider.delete(app, { signal: abort.signal }));

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(abort.signal);
      expect(ajaxMock.Apps.deleteAppV2).toBeCalledTimes(1);
      expect(ajaxMock.Apps.deleteAppV2).toBeCalledWith(app.appName, app.workspaceId);
    });

    it('handles delete app error with no workspace', async () => {
      // Arrange
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: null,
      };

      // Act (called from assert because expecting throw
      const shouldThrow = async () => {
        await leoAppProvider.delete(app);
      };

      // Assert;
      await expect(shouldThrow()).rejects.toEqual(
        new Error(
          `Deleting apps is currently only supported for azure or google apps. Azure apps must have a workspace id. App: ${app.appName} workspaceId: null`
        )
      );
      expect(Apps).toBeCalledTimes(0);
    });

    it('handles get app call', async () => {
      // Arrange
      const ajaxMock = mockAjaxNeeds();
      const abort = new window.AbortController();
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: defaultAzureWorkspace.workspace.workspaceId,
      };

      // Act
      void (await leoAppProvider.get(app, { signal: abort.signal }));

      // Assert;
      expect(Apps).toBeCalledTimes(1);
      expect(Apps).toBeCalledWith(abort.signal);
      expect(ajaxMock.Apps.getAppV2).toBeCalledTimes(1);
      expect(ajaxMock.Apps.getAppV2).toBeCalledWith(app.appName, app.workspaceId);
    });

    it('handles get app error with no workspace', async () => {
      // Arrange
      const app: AppBasics = {
        appName: 'myAppName',
        cloudContext: {
          cloudProvider: 'AZURE',
          cloudResource: 'myAzureResource',
        },
        workspaceId: null,
      };

      // Act (called from assert because expecting throw
      const shouldThrow = async () => {
        await leoAppProvider.get(app);
      };

      // Assert;
      await expect(shouldThrow()).rejects.toEqual(
        new Error(
          `Getting apps is currently only supported for azure or google apps. Azure apps must have a workspace id. App: ${app.appName} workspaceId: null`
        )
      );
      expect(Apps).toBeCalledTimes(0);
    });
  });
});
