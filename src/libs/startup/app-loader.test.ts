import { delay } from '@terra-ui-packages/core-utils';
import { act } from 'react-dom/test-utils';
import { startPollingServiceAlerts } from 'src/alerts/service-alerts-polling';
import { startPollingVersion } from 'src/alerts/version-polling';
import { initializeAuthListeners, initializeAuthUser } from 'src/auth/app-load/init-auth';
import { initAuthTesting } from 'src/auth/app-load/init-auth-test';
import { initializeAuthMetrics } from 'src/auth/app-load/init-metrics';
import { initializeClientId } from 'src/auth/app-load/initializeClientId';
import { initializeSystemProperties } from 'src/auth/system-loader';
import { mountAjaxOverrideUtils } from 'src/libs/ajax/ajax-override-utils';
import { isAxeEnabled } from 'src/libs/config';
import { setupAjaxTestUtil } from 'src/libs/startup/ajax-test-root';
import { initAxeTools } from 'src/libs/startup/axe-core';
import Main from 'src/pages/Main';
import { asMockedFn } from 'src/testing/test-utils';

import { doAppLoad } from './app-loader';

jest.mock('src/alerts/service-alerts-polling');
jest.mock('src/alerts/version-polling');
jest.mock('src/auth/app-load/init-auth');
jest.mock('src/auth/app-load/init-auth-test');
jest.mock('src/auth/app-load/init-metrics');
jest.mock('src/auth/app-load/initializeClientId');
jest.mock('src/auth/system-loader');
jest.mock('src/libs/ajax/ajax-override-utils');
jest.mock('src/libs/startup/ajax-test-root');
jest.mock('src/libs/startup/axe-core');

// avoid brand colors bootstrapping
jest.mock('src/libs/style');

type ConfigExports = typeof import('src/libs/config');
jest.mock(
  'src/libs/config',
  (): ConfigExports => ({
    ...jest.requireActual<ConfigExports>('src/libs/config'),
    getConfig: jest.fn(() => ({ brand: 'terra' })),
    isAxeEnabled: jest.fn(() => false),
  })
);

type MainPageExports = typeof import('src/pages/Main') & {
  __esModule: true;
};
jest.mock(
  'src/pages/Main',
  (): MainPageExports => ({
    __esModule: true,
    default: jest.fn(),
  })
);

describe('doAppLoad', () => {
  beforeAll(() => {
    asMockedFn(Main).mockReturnValue('Mock Main Page');
    asMockedFn(initializeClientId).mockResolvedValue(undefined);
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('mounts main component and calls expected load helpers', async () => {
    // Act
    await act(async () => {
      await doAppLoad();
    });
    await delay(100);

    // Assert

    expect(startPollingServiceAlerts).toBeCalledTimes(1);
    expect(startPollingVersion).toBeCalledTimes(1);
    expect(initializeAuthListeners).toBeCalledTimes(1);
    expect(initializeAuthUser).toBeCalledTimes(1);
    expect(initAuthTesting).toBeCalledTimes(1);
    expect(initializeAuthMetrics).toBeCalledTimes(1);
    expect(initializeSystemProperties).toBeCalledTimes(1);
    expect(mountAjaxOverrideUtils).toBeCalledTimes(1);
    expect(setupAjaxTestUtil).toBeCalledTimes(1);

    expect(initAxeTools).toBeCalledTimes(0);

    // main page component called for rendering
    expect(Main).toBeCalledTimes(1);
  });

  it('initialized axe-tools when configured to do so', async () => {
    // Arrange
    asMockedFn(isAxeEnabled).mockReturnValue(true);

    // Act
    await act(async () => {
      await doAppLoad();
    });
    await delay(100);

    // Assert

    expect(startPollingServiceAlerts).toBeCalledTimes(1);
    expect(startPollingVersion).toBeCalledTimes(1);
    expect(initializeAuthListeners).toBeCalledTimes(1);
    expect(initializeAuthUser).toBeCalledTimes(1);
    expect(initAuthTesting).toBeCalledTimes(1);
    expect(initializeAuthMetrics).toBeCalledTimes(1);
    expect(initializeSystemProperties).toBeCalledTimes(1);
    expect(mountAjaxOverrideUtils).toBeCalledTimes(1);
    expect(setupAjaxTestUtil).toBeCalledTimes(1);

    // should now be called
    expect(initAxeTools).toBeCalledTimes(1);

    // main page component called for rendering
    expect(Main).toBeCalledTimes(1);
  });
});
