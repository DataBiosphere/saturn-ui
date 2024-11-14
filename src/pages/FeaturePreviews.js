import _ from 'lodash/fp';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { div, h, h2, p, span } from 'react-hyperscript-helpers';
import { Checkbox, Link, spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { PageBox } from 'src/components/PageBox';
import { SimpleFlexTable } from 'src/components/table';
import { TopBar } from 'src/components/TopBar';
import { isFeaturePreviewEnabled, toggleFeaturePreview, useAvailableFeaturePreviews } from 'src/libs/feature-previews';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

export const FeaturePreviews = () => {
  const { featurePreviews, loading, error } = useAvailableFeaturePreviews();

  // The source of truth for whether or not a feature preview is enabled is `isFeaturePreviewEnabled`, which reads
  // from local preferences. However, changing a local preference won't re-render this component and its checkboxes.
  // Thus, we also need to store this in component state and keep in sync with local preferences.
  const getFeaturePreviewState = useCallback(() => {
    return _.flow(
      _.map(({ id }) => [id, isFeaturePreviewEnabled(id)]),
      _.fromPairs
    )(featurePreviews);
  }, [featurePreviews]);

  // Map of feature preview ID => enabled boolean
  const [featurePreviewState, setFeaturePreviewState] = useState(getFeaturePreviewState);
  useEffect(() => {
    setFeaturePreviewState(getFeaturePreviewState());
  }, [getFeaturePreviewState]);

  return Utils.cond(
    [loading, () => spinnerOverlay],
    [error, () => p({ style: { margin: 0 } }, ['Unable to load feature previews.'])],
    [_.isEmpty(featurePreviews), () => p({ style: { margin: 0 } }, ['No feature previews available at this time.'])],
    () =>
      h(Fragment, [
        p([
          "Feature Preview gives you early access to the latest Terra features before they're made generally available to all users. Opt-in below to try new features and give feedback so Terra can continue to make improvements before the features are released. These features may change without notice.",
        ]),
        h(SimpleFlexTable, {
          'aria-label': 'Features',
          rowCount: featurePreviews.length,
          columns: [
            {
              size: { basis: 55, grow: 0 },
              field: 'enabled',
              headerRenderer: () => span({ className: 'sr-only' }, ['Enabled']),
              cellRenderer: ({ rowIndex }) => {
                const { id, title } = featurePreviews[rowIndex];
                return h(Checkbox, {
                  'aria-label': `Enable ${title}`,
                  checked: featurePreviewState[id],
                  onChange: (checked) => {
                    toggleFeaturePreview(id, checked);
                    setFeaturePreviewState(_.set(id, checked));
                  },
                });
              },
            },
            {
              size: { basis: 250 },
              field: 'description',
              headerRenderer: () => 'Description',
              cellRenderer: ({ rowIndex }) => {
                const { title, description, documentationUrl, feedbackUrl } = featurePreviews[rowIndex];
                return div([
                  p({ style: { fontWeight: 600, margin: '0.5rem 0 0.5rem' } }, [title]),
                  p({ style: { margin: '0.5rem 0' } }, [description]),
                  !!(documentationUrl || feedbackUrl) &&
                    p({ style: { margin: '0.5rem 0' } }, [
                      documentationUrl && h(Link, { ...Utils.newTabLinkProps, href: documentationUrl }, ['Documentation']),
                      !!(documentationUrl && feedbackUrl) && ' | ',
                      feedbackUrl && h(Link, { ...Utils.newTabLinkProps, href: feedbackUrl }, ['Submit feedback']),
                    ]),
                ]);
              },
            },
          ],
        }),
      ])
  );
};

const FeaturePreviewsPage = () =>
  h(FooterWrapper, [
    h(TopBar, { title: 'Feature Preview' }),
    h(PageBox, { role: 'main' }, [
      h2({ style: { ...Style.elements.sectionHeader, textTransform: 'uppercase' } }, ['Feature Preview']),
      h(FeaturePreviews),
    ]),
  ]);

export const navPaths = [
  {
    name: 'feature-previews',
    path: '/feature-preview',
    component: FeaturePreviewsPage,
    title: 'Feature Previews',
  },
];
