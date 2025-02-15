import { Modal, useUniqueId } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { b, h } from 'react-hyperscript-helpers';
import { useAnalysisExportState } from 'src/analysis/modals/ExportAnalysisModal/useAnalysisExportState';
import { analysisLauncherTabName, analysisTabName } from 'src/analysis/runtime-common-text';
import { FileExtension, stripExtension } from 'src/analysis/utils/file-utils';
import { analysisNameInput, analysisNameValidator } from 'src/analysis/utils/notebook-utils';
import { ToolLabel, toolToExtensionMap } from 'src/analysis/utils/tool-utils';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import ErrorView from 'src/components/ErrorView';
import { FormLabel } from 'src/libs/forms';
import { goToPath as navToPath } from 'src/libs/nav';
import { summarizeErrors } from 'src/libs/utils';
import { WorkspaceSelector } from 'src/workspaces/common/WorkspaceSelector';
import { isValidWsExportTarget, WorkspaceInfo, WorkspaceWrapper } from 'src/workspaces/utils';
import validate from 'validate.js';

const getAnalysisFileExtension = (toolLabel: ToolLabel): FileExtension => toolToExtensionMap[toolLabel];

export interface ExportAnalysisModalProps {
  fromLauncher?: boolean;
  onDismiss: (event: unknown) => void;
  printName: string;
  toolLabel: ToolLabel;
  workspace: WorkspaceWrapper;
}

export const ExportAnalysisModal: React.FC<ExportAnalysisModalProps> = ({
  fromLauncher,
  onDismiss,
  printName,
  toolLabel,
  workspace,
}) => {
  // State
  const uniqueId = useUniqueId();
  const unique = (prefix: string): string => `${prefix}-${uniqueId}`;
  const [newName, setNewName] = useState<string>(stripExtension(printName));
  const { workspaces, selectedWorkspace, existingAnalysisFiles, pendingCopy, selectWorkspace, copyAnalysis } =
    useAnalysisExportState(workspace, printName, toolLabel);

  const selectedWorkspaceId = selectedWorkspace ? selectedWorkspace.workspaceId : undefined;
  // TODO: better loading/error handling on existing names?
  const existingNames =
    existingAnalysisFiles.status === 'Ready'
      ? _.map(({ displayName }) => displayName, existingAnalysisFiles.state)
      : [];

  const copying = pendingCopy.status === 'Loading';
  const copiedToWorkspace: WorkspaceInfo | null =
    pendingCopy.status === 'Ready' && selectedWorkspace ? selectedWorkspace : null;
  const copyError = pendingCopy.status === 'Error' ? pendingCopy.error : null;

  // Render
  const formErrors = validate(
    { selectedWorkspaceId, newName },
    {
      selectedWorkspaceId: { presence: true },
      newName: analysisNameValidator(existingNames),
    },
    { prettify: (v) => ({ newName: 'Name' }[v] || validate.prettify(v)) }
  );

  return h(
    Modal,
    {
      title: 'Copy to Workspace',
      onDismiss,
      cancelText: copiedToWorkspace ? 'Stay Here' : undefined,
      okButton: h(
        ButtonPrimary,
        {
          tooltip: summarizeErrors(formErrors),
          disabled: !!formErrors,
          onClick: copiedToWorkspace
            ? () =>
                navToPath(fromLauncher ? analysisLauncherTabName : analysisTabName, {
                  namespace: copiedToWorkspace.namespace,
                  name: copiedToWorkspace.name,
                  analysisName: `${newName}.${getAnalysisFileExtension(toolLabel)}`,
                  toolLabel,
                })
            : () => copyAnalysis(newName),
        },
        [copiedToWorkspace ? 'Go to copied analysis' : 'Copy']
      ),
    },
    [
      copiedToWorkspace
        ? h(Fragment, [
            'Successfully copied ',
            b([newName]),
            ' to ',
            b([copiedToWorkspace.name]),
            '. Do you want to view the copied analysis?',
          ])
        : h(Fragment, [
            h(Fragment, [
              h(FormLabel, { htmlFor: unique('workspace-selector'), required: true }, ['Destination']),
              h(WorkspaceSelector, {
                id: unique('workspace-selector'),
                'aria-label': undefined,
                workspaces: _.filter(isValidWsExportTarget(workspace), workspaces),
                value: selectedWorkspaceId,
                onChange: (v: string): void => selectWorkspace(v),
              }),
            ]),
            h(Fragment, [
              h(FormLabel, { htmlFor: unique('analysis-name'), required: true }, ['Name']),
              analysisNameInput({
                error: summarizeErrors(formErrors?.newName),
                inputProps: {
                  id: unique('analysis-name'),
                  value: newName,
                  onChange: setNewName,
                },
              }),
            ]),
          ]),
      copying && spinnerOverlay,
      !!copyError && h(ErrorView, { error: copyError }),
    ]
  );
};

export default ExportAnalysisModal;
