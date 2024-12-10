import { atom } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { useStore } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

import { Alert } from './Alert';

export const getServiceAlerts = async (): Promise<Alert[]> => {
  const serviceAlerts = await FirecloudBucket().getServiceAlerts();
  const hashes = await Promise.all(_.map(_.flow(JSON.stringify, Utils.sha256), serviceAlerts));
  return _.flow(
    _.map(_.defaults({ severity: 'warn' })),
    _.zip(hashes),
    _.map(([id, alert]) => ({ ...alert, id })),
    _.uniqBy('id')
  )(serviceAlerts);
};

export const serviceAlertsStore = atom<Alert[]>([]);

export const useServiceAlerts = () => useStore(serviceAlertsStore);
