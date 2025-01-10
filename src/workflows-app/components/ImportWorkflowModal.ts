import { useThemeFromContext } from '@terra-ui-packages/components';
import { Modal } from '@terra-ui-packages/components';
import React, { CSSProperties } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonPrimary, ButtonSecondary, Link } from 'src/components/common';
import { getStyles as getErrorStyles } from 'src/components/ErrorView';
import { centeredSpinner, icon } from 'src/components/icons';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';
import { WorkspaceWrapper } from 'src/workspaces/utils';

export type ImportWorkflowModalProps = {
  importLoading: boolean;
  methodName: string;
  onDismiss: () => void;
  workspace: WorkspaceWrapper;
  namespace: string;
  setSelectedSubHeader: (subHeader: string) => void;
  methodId: string;
  successfulImport: boolean;
  errorMessage: string;
  name?: string;
};

export const ImportWorkflowModal: React.FC<ImportWorkflowModalProps> = (props): React.ReactNode => {
  const {
    importLoading,
    methodName,
    onDismiss,
    workspace,
    namespace,
    setSelectedSubHeader,
    methodId,
    successfulImport,
    errorMessage,
  } = props;
  const { colors } = useThemeFromContext();
  const errorStyles = getErrorStyles(colors);
  const successBody = () => {
    return div({}, [
      div({ style: { paddingBottom: '1.5rem', display: 'flex', flex: 'none' } }, [
        div({ style: { fontSize: 20, fontWeight: 600 } }, [`Success! ${methodName} has been added to your workspace.`]),
        div({ style: { marginLeft: 'auto', display: 'flex' } }, [
          onDismiss &&
            h(
              Link,
              {
                'aria-label': 'Close',
                style: { marginLeft: '1.5rem' },
                tabIndex: 0,
                onClick: onDismiss,
              },
              [icon('times', { size: 30 })]
            ),
        ]),
      ]),
      h(
        ButtonSecondary,
        {
          style: { border: '1px solid', borderRadius: 2, padding: '0.75rem' },
          onClick: () => {
            onDismiss();
            setSelectedSubHeader('workspace-workflows');
          },
        },
        ['View in my workspace']
      ),
      h(
        ButtonPrimary,
        {
          style: { marginLeft: '1.75rem', borderRadius: 2 },
          onClick: () =>
            Nav.goToPath('workspace-workflows-app-submission-config', {
              name: workspace.workspace.name,
              namespace,
              methodId,
            }),
        },
        ['Start configuring now']
      ),
      div({ style: { marginTop: '2rem' } }, [
        h(Link, { style: { paddingTop: '2.5rem' }, onClick: onDismiss }, ['Continue browsing workflows']),
      ]),
    ]);
  };

  const errorBody = () => {
    return div({}, [
      div({ style: { paddingBottom: '1.5rem', display: 'flex', flex: 'none' } }, [
        div({ style: { paddingRight: '1em' } }, [
          icon('warning-standard', { size: 20, style: { color: colors.danger() } }),
        ]),
        div({ style: { fontSize: 20, fontWeight: 600 } }, ['Error creating new method']),
        div({ style: { marginLeft: 'auto', display: 'flex' } }, [
          onDismiss &&
            h(
              Link,
              {
                'aria-label': 'Close',
                style: { marginLeft: '2rem' },
                tabIndex: 0,
                onClick: onDismiss,
              },
              [icon('times', { size: 30 })]
            ),
        ]),
      ]),
      div(
        {
          style: { ...(errorStyles.jsonFrame as CSSProperties), overflowY: 'scroll', maxHeight: 150 },
        },
        [errorMessage]
      ),
    ]);
  };

  return h(
    Modal,
    {
      width: 700,
      showButtons: !successfulImport,
      onDismiss,
      showCancel: false,
      okButton:
        !successfulImport &&
        h(
          ButtonPrimary,
          {
            onClick: onDismiss,
          },
          ['Close']
        ),
    },
    [
      importLoading
        ? centeredSpinner()
        : Utils.cond([successfulImport, () => successBody()], [!successfulImport, () => errorBody()]),
    ]
  );
};
