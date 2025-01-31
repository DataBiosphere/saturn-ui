import 'src/libs/ajax/ajax-override-utils';
import 'src/style.css';

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
import { isAxeEnabled } from 'src/libs/config';
import Main from 'src/pages/Main';

const rootElement = document.getElementById('root');

RModal.defaultStyles = { overlay: {}, content: {} };

window._ = _;

setupAjaxTestUtil();

initializeAuthListeners();
initializeAuthMetrics();
initAuthTesting();

initializeClientId().then(() => {
  const root = createRoot(rootElement);
  root.render(h(Main));

  // react-notifications-component sets up its Store in the componentDidMount method
  // of the ReactNotifications component. Use setTimeout to allow that to happen before
  // doing anything that may show a notification.
  setTimeout(() => {
    initializeSystemProperties();
    initializeAuthUser();
    startPollingServiceAlerts();
    startPollingVersion();
  }, 0);

  if (isAxeEnabled()) {
    import('src/libs/axe-core');
  }
});
