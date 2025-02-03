import { getConfig } from 'src/libs/config';
import * as Nav from 'src/libs/nav';

export const methodLink = (config) => {
  const {
    methodRepoMethod: { sourceRepo, methodVersion, methodNamespace, methodName, methodPath },
  } = config;

  if (sourceRepo === 'agora') {
    return Nav.getLink('workflow-dashboard', { namespace: methodNamespace, name: methodName, snapshotId: methodVersion });
  }
  return `${getConfig().dockstoreUrlRoot}/workflows/${methodPath}:${methodVersion}`;
};
