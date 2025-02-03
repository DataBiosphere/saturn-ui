import { Icon, Link } from '@terra-ui-packages/components';
import { ReactNode } from 'react';
import { div, h, label, li, ul } from 'react-hyperscript-helpers';
import { computeStyles } from 'src/analysis/modals/modalStyles';
import * as Utils from 'src/libs/utils';

export const AboutInstalledPackagesView = (): ReactNode => {
  return div([
    label({ style: computeStyles.label }, ['Pre-installed packages']),
    div({ style: { marginTop: '0.5rem' } }, [
      'Default system environment:',
      ul([li(['python 3.10.12']), li(['jupyterLab 4.1.6']), li(['miniconda 23.5.1'])]),
      h(
        Link,
        {
          href: 'https://raw.githubusercontent.com/DataBiosphere/terra-docker/ae65b9846e183718d6e6880d3249b43544ad53e4/terra-base-jupyter/poetry.lock',
          ...Utils.newTabLinkProps,
        },
        [
          'Learn more about the default system configuration',
          h(Icon, { icon: 'pop-out', size: 12, style: { marginLeft: '0.25rem' } }),
        ]
      ),
      'Your customizable environment:',
      ul([li(['firecloud 0.16.37']), li(['tera-notebook-utils 0.13.0'])]),
      h(
        Link,
        {
          href: 'https://raw.githubusercontent.com/DataBiosphere/terra-docker/ae65b9846e183718d6e6880d3249b43544ad53e4/terra-base-jupyter/conda-environment.yml',
          ...Utils.newTabLinkProps,
        },
        [
          'Learn more about the packages pre-installed on your analysis environment',
          h(Icon, { icon: 'pop-out', size: 12, style: { marginLeft: '0.25rem' } }),
        ]
      ),
    ]),
  ]);
};
