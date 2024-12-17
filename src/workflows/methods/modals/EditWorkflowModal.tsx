import { Modal, SpinnerOverlay, useUniqueId } from '@terra-ui-packages/components';
import React, { useState } from 'react';
import { LabeledCheckbox } from 'src/components/common';
import ErrorView from 'src/components/ErrorView';
import { TextInput } from 'src/components/input';
import { EditMethodProvider } from 'src/libs/ajax/methods/providers/EditMethodProvider';
import { FormLabel } from 'src/libs/forms';
import { withBusyState } from 'src/libs/utils';
import {
  DocumentationSection,
  SubmitWorkflowModalButton,
  SynopsisSnapshotSection,
  WdlBoxSection,
  workflowModalCommonConstraints,
  WorkflowModalCommonProps,
} from 'src/workflows/methods/modals/WorkflowModalCommon';
import validate from 'validate.js';

export interface EditWorkflowModalProps extends WorkflowModalCommonProps {
  /**
   * Prefilled method namespace that can't be edited
   */
  namespace: string;

  /**
   * Prefilled method name that can't be edited
   */
  name: string;

  /**
   * Snapshot ID of the snapshot whose details are populated in the modal
   */
  snapshotId: number;

  /**
   * Provides functions related to API call to edit method. This provider is
   * used for creating new snapshot functionality.
   */
  editMethodProvider: EditMethodProvider;
}

/**
 * Component for inputting workflow information to facilitate creating new workflow snapshot.
 */
export const EditWorkflowModal = (props: EditWorkflowModalProps) => {
  const {
    title,
    namespace,
    name,
    defaultWdl,
    defaultDocumentation,
    defaultSynopsis,
    snapshotId,
    editMethodProvider,
    onSuccess,
    onDismiss,
  } = props;

  const [wdl, setWdl] = useState<string>(defaultWdl ?? '');
  const [documentation, setDocumentation] = useState<string>(defaultDocumentation ?? '');
  const [synopsis, setSynopsis] = useState<string>(defaultSynopsis ?? '');
  const [snapshotComment, setSnapshotComment] = useState<string>('');
  const [redactPreviousSnapshot, setRedactPreviousSnapshot] = useState<boolean>(false);

  const [busy, setBusy] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<any>(null);

  const validationErrors = validate({ synopsis, wdl }, workflowModalCommonConstraints, {
    prettify: (v) => ({ synopsis: 'Synopsis', wdl: 'WDL' }[v] || validate.prettify(v)),
  });

  const namespaceInputId = useUniqueId();
  const nameInputId = useUniqueId();

  const onSubmitWorkflow = withBusyState(setBusy, async () => {
    try {
      const {
        namespace: createdWorkflowNamespace,
        name: createdWorkflowName,
        snapshotId: createdWorkflowSnapshotId,
      } = await editMethodProvider.createNewSnapshot(
        namespace,
        name,
        snapshotId,
        redactPreviousSnapshot,
        synopsis,
        documentation,
        wdl,
        snapshotComment
      );
      onSuccess(createdWorkflowNamespace, createdWorkflowName, createdWorkflowSnapshotId);
    } catch (error) {
      setSubmissionError(error instanceof Response ? await error.text() : error);
    }
  });

  return (
    <Modal
      onDismiss={onDismiss}
      title={title}
      width='75rem'
      okButton={SubmitWorkflowModalButton({
        buttonActionName: 'Create new snapshot',
        validationErrors,
        onSubmitWorkflow,
      })}
    >
      <div style={{ padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flexWrap: 'wrap', flexGrow: 1, flexBasis: '400px' }}>
            <div style={{ marginBottom: '0.1667em' }}>
              <FormLabel htmlFor={namespaceInputId}>Namespace</FormLabel>
              <TextInput id={namespaceInputId} placeholder={namespace} disabled />
            </div>
          </div>
          <div style={{ flexWrap: 'wrap', flexGrow: 1, flexBasis: '400px' }}>
            <div style={{ marginBottom: '0.1667em' }}>
              <FormLabel htmlFor={nameInputId}>Name</FormLabel>
              <TextInput id={nameInputId} placeholder={name} disabled />
            </div>
          </div>
        </div>
        <div style={{ paddingTop: '1.5rem' }}>
          <WdlBoxSection wdlPayload={wdl} setWdlPayload={setWdl} />
        </div>
        <DocumentationSection documentation={documentation} setWorkflowDocumentation={setDocumentation} />
        <SynopsisSnapshotSection
          synopsis={synopsis}
          snapshotComment={snapshotComment}
          setWorkflowSynopsis={setSynopsis}
          setSnapshotComment={setSnapshotComment}
          errors={validationErrors}
        />
        <div style={{ paddingTop: '1.5rem' }}>
          <LabeledCheckbox checked={redactPreviousSnapshot} onChange={setRedactPreviousSnapshot}>
            <span style={{ marginLeft: '0.5rem' }}>Delete version {snapshotId}</span>
          </LabeledCheckbox>
        </div>
        {busy && <SpinnerOverlay />}
        {submissionError && <ErrorView error={submissionError} />}
      </div>
    </Modal>
  );
};
