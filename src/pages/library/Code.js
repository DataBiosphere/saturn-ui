import { icon } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { Clickable, Link } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { centeredSpinner } from 'src/components/icons';
import { libraryTopMatter } from 'src/components/library-common';
import broadSquare from 'src/images/library/code/broad-square.svg';
import dockstoreLogo from 'src/images/library/code/dockstore.svg';
import { Dockstore } from 'src/libs/ajax/Dockstore';
import { FirecloudBucket } from 'src/libs/ajax/firecloud/FirecloudBucket';
import { Methods } from 'src/libs/ajax/methods/Methods';
import { getEnabledBrand } from 'src/libs/brand-utils';
import colors from 'src/libs/colors';
import { getConfig } from 'src/libs/config';
import { withErrorReporting } from 'src/libs/error';
import { isFeaturePreviewEnabled } from 'src/libs/feature-previews';
import { FIRECLOUD_UI_MIGRATION } from 'src/libs/feature-previews-config';
import * as Nav from 'src/libs/nav';
import { useCancellation, useOnMount } from 'src/libs/react-utils';
import * as Style from 'src/libs/style';
import * as Utils from 'src/libs/utils';

const styles = {
  header: {
    fontSize: 22,
    color: colors.dark(),
    fontWeight: 500,
    lineHeight: '22px',
    marginBottom: '1rem',
  },
};

export const MethodCard = ({ method, ...props }) => {
  const isMethodsRepoMethod = method.namespace && method.name;

  const name = isMethodsRepoMethod ? method.name : method.toolname;
  const description = isMethodsRepoMethod ? method.synopsis : method.description;

  return h(
    Clickable,
    {
      ...props,
      style: {
        ...Style.elements.card.container,
        backgroundColor: 'white',
        width: 390,
        height: 140,
        padding: undefined,
        margin: '0 30px 27px 0',
        position: 'relative',
      },
    },
    [
      div({ style: { flex: 'none', padding: '15px 20px', height: 140 } }, [
        div({ style: { color: colors.accent(), fontSize: 16, lineHeight: '20px', height: 40, marginBottom: 7 } }, [name]),
        div({ style: { lineHeight: '20px', ...Style.noWrapEllipsis, whiteSpace: 'pre-wrap', height: 60 } }, [description]),
      ]),
      icon('wdl', { size: 20, style: { position: 'absolute', top: 0, right: 8 } }),
    ]
  );
};

const LogoTile = ({ logoFile, ...props }) => {
  return div(
    _.merge(
      {
        style: {
          flexShrink: 0,
          backgroundImage: `url(${logoFile})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 27,
          width: 37,
          height: 37,
          marginRight: 13,
        },
      },
      props
    )
  );
};

export const DockstoreTile = () => {
  return div({ style: { display: 'flex' } }, [
    h(LogoTile, { logoFile: dockstoreLogo, style: { backgroundColor: 'white' } }),
    div([
      h(
        Link,
        {
          href: `${getConfig().dockstoreUrlRoot}/search?_type=workflow&descriptorType=WDL&searchMode=files`,
          style: { color: colors.accent(1.1) }, // For a11y, we need at least 4.5:1 contrast against the gray background
        },
        'Dockstore'
      ),
      div(['Browse WDL workflows in Dockstore, an open platform used by the GA4GH for sharing Docker-based workflows']),
    ]),
  ]);
};

export const MethodRepoTile = () => {
  return div({ style: { display: 'flex' } }, [
    h(LogoTile, { logoFile: broadSquare, style: { backgroundSize: 37 } }),
    div([
      h(
        Link,
        {
          href: isFeaturePreviewEnabled(FIRECLOUD_UI_MIGRATION)
            ? Nav.getLink('workflows')
            : `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#methods`,
          style: { color: colors.accent(1.1) }, // For a11y, we need at least 4.5:1 contrast agaisnst the gray background
        },
        'Terra Workflow Repository'
      ),
      div([`Use Terra-hosted workflows in ${getEnabledBrand().name}. Share your own, or choose from > 700 public workflows`]),
    ]),
  ]);
};

const getFeaturedMethods = async (signal) => {
  const [featuredMethods, methodsRepoMethodsList, dockstoreMethodsList] = await Promise.all([
    FirecloudBucket(signal).getFeaturedMethods(),
    Methods(signal).list({ namespace: 'gatk' }),
    Dockstore(signal).listTools({ organization: 'gatk-workflows' }),
  ]);

  const methodsRepoMethodDetails = _.flow(
    _.groupBy(({ namespace, name }) => `${namespace}/${name}`),
    _.mapValues(_.maxBy('snapshotId'))
  )(methodsRepoMethodsList);

  const dockstoreMethodDetails = _.keyBy('id', dockstoreMethodsList);

  return _.flow(
    _.map(({ namespace, name, id }) =>
      Utils.cond([id, () => _.get(id, dockstoreMethodDetails)], [namespace && name, () => _.get(`${namespace}/${name}`, methodsRepoMethodDetails)])
    ),
    _.compact
  )(featuredMethods);
};

export const Code = () => {
  const signal = useCancellation();
  const [featuredMethods, setFeaturedMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  useOnMount(() => {
    const loadData = _.flow(
      withErrorReporting('Error loading workflows'),
      Utils.withBusyState(setLoading)
    )(async () => {
      setFeaturedMethods(await getFeaturedMethods(signal));
    });
    loadData();
  });

  return h(FooterWrapper, { alwaysShow: true }, [
    libraryTopMatter('workflows'),
    div({ role: 'main', style: { flexGrow: 1 } }, [
      div({ style: { display: 'flex', flex: 1 } }, [
        div({ style: { flex: 1, margin: '30px 0 30px 40px' } }, [
          div({ style: styles.header }, 'GATK4 Best Practices workflows'),
          div({ style: { display: 'flex', flexWrap: 'wrap' } }, [
            _.map((method) => {
              const { namespace, name, id } = method;
              const isMethodsRepoMethod = !!(namespace && name);
              const href = isMethodsRepoMethod
                ? `${getConfig().firecloudUrlRoot}/?return=${getEnabledBrand().queryName}#methods/${namespace}/${name}/`
                : `${getConfig().dockstoreUrlRoot}/workflows/${id.replace(/^#workflow\//, '')}`;

              return h(MethodCard, {
                key: `${namespace}/${name}`,
                href,
                method,
              });
            }, featuredMethods),
          ]),
        ]),
        div({ style: { width: 385, padding: '25px 30px', backgroundColor: colors.light(0.7), lineHeight: '20px' } }, [
          div({ style: { ...styles.header, fontSize: 16 } }, 'FIND ADDITIONAL WORKFLOWS'),
          h(DockstoreTile),
          div({ style: { marginTop: 40 } }, [h(MethodRepoTile)]),
        ]),
      ]),
      loading && centeredSpinner(),
    ]),
  ]);
};

export const navPaths = [
  {
    name: 'library-code',
    path: '/library/code',
    component: Code,
    public: false,
    title: 'Workflows',
  },
];
