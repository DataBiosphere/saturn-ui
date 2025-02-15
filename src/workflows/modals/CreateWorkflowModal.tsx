import { Modal, SpinnerOverlay, useUniqueId } from '@terra-ui-packages/components';
import React, { useState } from 'react';
import ErrorView from 'src/components/ErrorView';
import { ValidatedInput } from 'src/components/input';
import { PostMethodProvider } from 'src/libs/ajax/methods/providers/PostMethodProvider';
import { Metrics } from 'src/libs/ajax/Metrics';
import Events from 'src/libs/events';
import { FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import {
  DocumentationSection,
  SubmitWorkflowModalButton,
  SynopsisSnapshotSection,
  WdlBoxSection,
  workflowModalCommonConstraints,
  WorkflowModalCommonProps,
} from 'src/workflows/modals/WorkflowModalCommon';
import validate from 'validate.js';

export interface CreateWorkflowModalProps extends WorkflowModalCommonProps {
  /**
   * The default value to be prefilled in the namespace input. If not present,
   * the input will initially be blank.
   */
  defaultNamespace?: string;

  /**
   * The default value to be prefilled in the name input. If not present, the
   * input will initially be blank.
   */
  defaultName?: string;

  /** The text to be shown on the primary button of the modal. */
  buttonActionName: string;

  /**
   * Provides a function to make an API call to perform the post method
   * operation. The postMethod function provided is called with the information
   * inputted into the modal. This provider is used for both "create new workflow"
   * and "clone workflow snapshot" functionality.
   */
  postMethodProvider: PostMethodProvider;
}

// Custom validator used to ensure that the namespace and name input values do
// not exceed their maximum combined length
validate.validators.maxNamespaceNameCombinedLength = <OtherFieldName extends string>(
  value: string,
  options: { otherField: OtherFieldName },
  _key: string,
  attributes: Record<OtherFieldName, string>
): string | null =>
  value.length + attributes[options.otherField].length > 250
    ? '^Collection and workflow names are too long (maximum is 250 characters total)' // ^ character prevents attribute from being prepended
    : null;

const createWorkflowModalConstraints = {
  ...workflowModalCommonConstraints,
  namespace: {
    presence: { allowEmpty: false },
    format: {
      pattern: /^[A-Za-z0-9_\-.]*$/,
      message: 'can only contain letters, numbers, underscores, dashes, and periods',
    },
    maxNamespaceNameCombinedLength: {
      otherField: 'name',
    },
  },
  name: {
    presence: { allowEmpty: false },
    format: {
      pattern: /^[A-Za-z0-9_\-.]*$/,
      message: 'can only contain letters, numbers, underscores, dashes, and periods',
    },
    maxNamespaceNameCombinedLength: {
      otherField: 'namespace',
    },
  },
};

interface CollectionAndWfNameSectionProps {
  namespace: string | undefined;
  name: string | undefined;
  setWorkflowNamespace: (value: string) => void;
  setWorkflowName: (value: string) => void;
  errors: any;
}

const CollectionAndWfNameSection = (props: CollectionAndWfNameSectionProps) => {
  const { namespace, name, setWorkflowNamespace, setWorkflowName, errors } = props;
  const [namespaceModified, setNamespaceModified] = useState<boolean>(false);
  const [nameModified, setNameModified] = useState<boolean>(false);

  const namespaceInputId = useUniqueId();
  const nameInputId = useUniqueId();

  return (
    <>
      <div style={{ flexWrap: 'wrap', flexGrow: 1, flexBasis: '400px' }}>
        <div style={{ marginBottom: '0.1667em' }}>
          <FormLabel htmlFor={namespaceInputId} required>
            Collection name
          </FormLabel>
          <ValidatedInput
            inputProps={{
              id: namespaceInputId,
              autoFocus: true,
              value: namespace,
              onChange: (v) => {
                setWorkflowNamespace(v);
                setNamespaceModified(true);
              },
            }}
            error={Utils.summarizeErrors((namespaceModified || namespace) && errors?.namespace)}
          />
        </div>
      </div>
      <div style={{ flexWrap: 'wrap', flexGrow: 1, flexBasis: '400px' }}>
        <div style={{ marginBottom: '0.1667em' }}>
          <FormLabel htmlFor={nameInputId} required>
            Workflow name
          </FormLabel>
          <ValidatedInput
            inputProps={{
              id: nameInputId,
              value: name,
              onChange: (v) => {
                setWorkflowName(v);
                setNameModified(true);
              },
            }}
            error={Utils.summarizeErrors((nameModified || name) && errors?.name)}
          />
        </div>
      </div>
    </>
  );
};

/**
 * Component for inputting workflow information to facilitate creating new workflow or cloning a workflow snapshot.
 * Note: During the migration and release of the new Terra Workflow Repository UI, some terminology changes were
 *       introduced. As a result, certain terms in the UI may differ from those used in the code. Below are the
 *       terms in this component that have been renamed (or is referred as) specifically for user-facing purposes:
 *          method    -> workflow
 *          namespace -> collection
 *          name      -> workflow name
 *          snapshot  -> version
 */
export const CreateWorkflowModal = (props: CreateWorkflowModalProps) => {
  const {
    title,
    buttonActionName,
    defaultNamespace,
    defaultName,
    defaultWdl,
    defaultDocumentation,
    defaultSynopsis,
    postMethodProvider,
    onSuccess,
    onDismiss,
  } = props;

  const [namespace, setNamespace] = useState<string>(defaultNamespace ?? '');
  const [name, setName] = useState<string>(defaultName ?? '');
  const [wdl, setWdl] = useState<string>(defaultWdl ?? '');
  const [documentation, setDocumentation] = useState<string>(defaultDocumentation ?? '');
  const [synopsis, setSynopsis] = useState<string>(defaultSynopsis ?? '');
  const [snapshotComment, setSnapshotComment] = useState<string>('');

  const [busy, setBusy] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<any>(null);

  const validationErrors = validate({ namespace, name, synopsis, wdl }, createWorkflowModalConstraints, {
    prettify: (v) =>
      ({ namespace: 'Collection name', name: 'Workflow name', synopsis: 'Synopsis', wdl: 'WDL' }[v] ||
      validate.prettify(v)),
  });

  const onSubmitWorkflow = withBusyState(setBusy, async () => {
    try {
      const {
        namespace: createdWorkflowNamespace,
        name: createdWorkflowName,
        snapshotId: createdWorkflowSnapshotId,
      } = await postMethodProvider.postMethod(namespace, name, wdl, documentation, synopsis, snapshotComment);

      void Metrics().captureEvent(Events.workflowRepoCreateWorkflow, {
        collectionName: createdWorkflowNamespace,
        workflowName: createdWorkflowName,
      });

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
      okButton={SubmitWorkflowModalButton({ buttonActionName, validationErrors, onSubmitWorkflow })}
    >
      <div style={{ padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <CollectionAndWfNameSection
            namespace={namespace}
            name={name}
            setWorkflowNamespace={setNamespace}
            setWorkflowName={setName}
            errors={validationErrors}
          />
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
        {busy && <SpinnerOverlay />}
        {submissionError && <ErrorView error={submissionError} />}
      </div>
    </Modal>
  );
};
