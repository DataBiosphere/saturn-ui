import { Modal } from '@terra-ui-packages/components';
import _ from 'lodash/fp';
import { Fragment, useState } from 'react';
import { h } from 'react-hyperscript-helpers';
import { analysisLauncherTabName } from 'src/analysis/runtime-common-text';
import { useAnalysisFiles } from 'src/analysis/useAnalysisFiles';
import { DisplayName, FileName, getDisplayName, getExtension, getFileName } from 'src/analysis/utils/file-utils';
import { analysisNameInput, analysisNameValidator } from 'src/analysis/utils/notebook-utils';
import { ToolLabel } from 'src/analysis/utils/tool-utils';
import { ButtonPrimary } from 'src/components/common';
import { centeredSpinner } from 'src/components/icons';
import { AzureStorage } from 'src/libs/ajax/AzureStorage';
import { GoogleStorage } from 'src/libs/ajax/GoogleStorage';
import { Metrics } from 'src/libs/ajax/Metrics';
import { withErrorReportingInModal } from 'src/libs/error';
import Events, { extractCrossWorkspaceDetails, extractWorkspaceDetails } from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';
import { isGoogleWorkspaceInfo, WorkspaceInfo } from 'src/workspaces/utils';
import validate from 'validate.js';

export interface AnalysisDuplicatorProps {
  destroyOld?: boolean;
  fromLauncher?: boolean;
  printName: FileName;
  toolLabel: ToolLabel;
  workspaceInfo: WorkspaceInfo;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const AnalysisDuplicator = ({
  destroyOld = false,
  fromLauncher = false,
  printName,
  toolLabel,
  workspaceInfo,
  onDismiss,
  onSuccess,
}: AnalysisDuplicatorProps) => {
  const [newName, setNewName] = useState<string>('');
  const { loadedState } = useAnalysisFiles();
  const analyses = loadedState.status !== 'None' ? loadedState.state : null;

  const existingNames: DisplayName[] = _.map(({ name }) => getDisplayName(name), analyses);

  const [nameTouched, setNameTouched] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

  const errors = validate(
    { newName },
    { newName: analysisNameValidator(existingNames) },
    { prettify: (v) => ({ newName: 'Name' }[v] || validate.prettify(v)) }
  );

  return h(
    Modal,
    {
      onDismiss,
      title: `${destroyOld ? 'Rename' : 'Copy'} "${printName}"`,
      okButton: h(
        ButtonPrimary,
        {
          disabled: errors || processing,
          tooltip: Utils.summarizeErrors(errors),
          onClick: withErrorReportingInModal(
            `Error ${destroyOld ? 'renaming' : 'copying'} analysis`,
            onDismiss
          )(async () => {
            setProcessing(true);
            const rename = isGoogleWorkspaceInfo(workspaceInfo)
              ? () =>
                  GoogleStorage()
                    .analysis(workspaceInfo.googleProject, workspaceInfo.bucketName, printName, toolLabel)
                    .rename(newName)
              : () => AzureStorage().blob(workspaceInfo.workspaceId, printName).rename(newName);

            const duplicate = isGoogleWorkspaceInfo(workspaceInfo)
              ? () =>
                  GoogleStorage()
                    .analysis(workspaceInfo.googleProject, workspaceInfo.bucketName, getFileName(printName), toolLabel)
                    .copy(`${newName}.${getExtension(printName)}`, workspaceInfo.bucketName, true)
              : () => AzureStorage().blob(workspaceInfo.workspaceId, printName).copy(newName);

            if (destroyOld) {
              await rename();
              Metrics().captureEvent(Events.notebookRename, {
                oldName: printName,
                newName,
                ...extractWorkspaceDetails(workspaceInfo),
              });
            } else {
              await duplicate();
              Metrics().captureEvent(Events.notebookCopy, {
                oldName: printName,
                newName,
                ...extractCrossWorkspaceDetails({ workspace: workspaceInfo }, { workspace: workspaceInfo }),
              });
            }

            onSuccess();
            if (fromLauncher) {
              Nav.goToPath(analysisLauncherTabName, {
                namespace: workspaceInfo.namespace,
                name: workspaceInfo.name,
                analysisName: `${newName}.${getExtension(printName)}`,
                toolLabel,
              });
            }
          }),
        },
        [`${destroyOld ? 'Rename' : 'Copy'} Analysis`]
      ),
    },
    Utils.cond([processing, () => [centeredSpinner()]], () => [
      h(Fragment, [
        h(FormLabel, { htmlFor: 'analysis-duplicator-id', required: true }, ['New Name']),
        analysisNameInput({
          error: Utils.summarizeErrors(nameTouched && errors && errors.newName),
          inputProps: {
            id: 'analysis-duplicator-id',
            value: newName,
            onChange: (v) => {
              setNewName(v as DisplayName);
              setNameTouched(true);
            },
          },
        }),
      ]),
    ])
  );
};
