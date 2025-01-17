import _ from 'lodash/fp';
import { useState } from 'react';
import { Groups } from 'src/libs/ajax/Groups';
import { Metrics } from 'src/libs/ajax/Metrics';
import { getConfig } from 'src/libs/config';
import Events from 'src/libs/events';
import featurePreviewsConfig from 'src/libs/feature-previews-config';
import { getLocalPref, setLocalPref } from 'src/libs/prefs';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Utils from 'src/libs/utils';

const featurePreviewPreferenceKey = (id) => `feature-preview/${id}`;

export const isFeaturePreviewEnabled = (id) => !!getLocalPref(featurePreviewPreferenceKey(id));

export const toggleFeaturePreview = (id, enabled) => {
  setLocalPref(featurePreviewPreferenceKey(id), enabled);
  Metrics().captureEvent(Events.featurePreviewToggle, { featureId: id, enabled });
};

const getGroups = async ({ signal } = {}) => {
  const rawGroups = await Groups(signal).list();
  return _.flow(_.map('groupName'), _.uniq)(rawGroups);
};

export const getAvailableFeaturePreviews = async ({ signal } = {}) => {
  const userGroups = await getGroups({ signal });

  return _.filter(({ id, groups: previewGroups }) =>
    Utils.cond(
      // Allow access to all feature previews in development.
      [!getConfig().isProd, () => true],
      // Feature previews may be configured to only be available for members of certain groups.
      // Any enabled feature previews should always be shown to allow users to turn them off
      // even if they've been removed from the preview group.
      [!_.isNil(previewGroups), () => _.size(_.intersection(userGroups, previewGroups)) > 0 || isFeaturePreviewEnabled(id)],
      () => true
    )
  )(featurePreviewsConfig);
};

export const useAvailableFeaturePreviews = () => {
  const [featurePreviews, setFeaturePreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const signal = useCancellation();

  useOnMount(() => {
    const loadAvailableFeaturePreviews = Utils.withBusyState(setLoading, async () => {
      try {
        setFeaturePreviews(await getAvailableFeaturePreviews({ signal }));
      } catch (error) {
        setError(error);
      }
    });

    loadAvailableFeaturePreviews();
  });

  return { featurePreviews, loading, error };
};
