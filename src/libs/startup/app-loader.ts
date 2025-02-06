import { LoDashStatic } from 'lodash';
import _ from 'lodash/fp';
import { createRoot } from 'react-dom/client';
import { h } from 'react-hyperscript-helpers';
import RModal from 'react-modal';
import { startPollingServiceAlerts } from 'src/alerts/service-alerts-polling';
import { startPollingVersion } from 'src/alerts/version-polling';
import { initializeAuthListeners, initializeAuthUser } from 'src/auth/app-load/init-auth';
import { initAuthTesting } from 'src/auth/app-load/init-auth-test';
import { initializeAuthMetrics } from 'src/auth/app-load/init-metrics';
import { initializeClientId } from 'src/auth/app-load/initializeClientId';
import { initializeSystemProperties } from 'src/auth/system-loader';
import { setupAjaxTestUtil } from 'src/libs/ajax';
import { mountAjaxOverrideUtils } from 'src/libs/ajax/ajax-override-utils';
import { isAxeEnabled } from 'src/libs/config';
import Main from 'src/pages/Main';

declare global {
  interface Window {
    _: _.LoDashFp & LoDashStatic;
  }
}

export const doAppLoad = () => {
  const rootElement = document.getElementById('root');

  RModal.defaultStyles = { overlay: {}, content: {} };

  // a shim for package build compatibility
  window._ = _ as _.LoDashFp & LoDashStatic;

  setupAjaxTestUtil();
  mountAjaxOverrideUtils();

  initializeAuthListeners();
  initializeAuthMetrics();
  initAuthTesting();

  initializeClientId().then(() => {
    const root = createRoot(rootElement!);
    root.render(h(Main));

    // react-notifications-component sets up its Store in the componentDidMount method
    // of the ReactNotifications component. Use setTimeout to allow that to happen before
    // doing anything that may show a notification.
    setTimeout(() => {
      void initializeSystemProperties();
      void initializeAuthUser();
      startPollingServiceAlerts();
      startPollingVersion();
    }, 0);

    if (isAxeEnabled()) {
      import('src/libs/axe-core');
    }
  });
};
