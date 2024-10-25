import { ButtonPrimary, Clickable, Modal, SpinnerOverlay, useUniqueId } from '@terra-ui-packages/components';
import { readFileAsText } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import Dropzone from 'src/components/Dropzone';
import ErrorView from 'src/components/ErrorView';
import { TextArea, TextInput, ValidatedInput } from 'src/components/input';
import { CreateMethodProvider } from 'src/libs/ajax/methods/providers/CreateMethodProvider';
import colors from 'src/libs/colors';
import { FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import { withBusyState } from 'src/libs/utils';
import { WDLEditor } from 'src/pages/workflows/common/WDLEditor';
import validate from 'validate.js';

export interface WorkflowModalProps {
  /** The title to be shown at the top of the modal. */
  title: string;

  /** The text to be shown on the primary button of the modal. */
  buttonActionName: string;

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

  /**
   * The default value to be prefilled in the WDL input. If not present, the
   * input will initially be blank.
   */
  defaultWdl?: string;

  /**
   * The default value to be prefilled in the documentation input. If not
   * present, the input will initially be blank.
   */
  defaultDocumentation?: string;

  /**
   * The default value to be prefilled in the synopsis input. If not present,
   * the input will initially be blank.
   */
  defaultSynopsis?: string;

  /**
   * The default value to be prefilled in the snapshot comment input. If not
   * present, the input will initially be blank.
   */
  defaultSnapshotComment?: string;

  /**
   * Provides a function to make an API call to perform the create method
   * operation. The create function provided is called with the information
   * inputted into the modal.
   */
  createMethodProvider: CreateMethodProvider;

  /**
   * The function to be called with the namespace, name, and snapshot ID of the
   * created method snapshot after the user presses the primary modal button and
   * the triggered operation successfully completes.
   */
  onSuccess: (namespace: string, name: string, snapshotId: number) => void;

  /**
   * Called when the underlying modal is dismissed (e.g., when the Cancel button
   * is pressed or the user clicks outside the modal).
   */
  onDismiss: () => void;
}

interface NamespaceNameSectionProps {
  namespace: string | undefined;
  name: string | undefined;
  setWorkflowNamespace: (value: string) => void;
  setWorkflowName: (value: string) => void;
  errors: any;
}

interface SynopsisSnapshotSectionProps {
  synopsis: string;
  snapshotComment: string;
  setWorkflowSynopsis: (value: string) => void;
  setSnapshotComment: (value: string) => void;
  errors: any;
}

interface WdlBoxSectionProps {
  wdlPayload: string;
  setWdlPayload: (value: string) => void;
}

interface DocumentationSectionProps {
  documentation: string;
  setWorkflowDocumentation: (value: string) => void;
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
    ? '^Namespace and name are too long (maximum is 250 characters total)' // ^ character prevents attribute from being prepended
    : null;

const constraints = {
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
  synopsis: {
    length: { maximum: 80 },
  },
  wdl: {
    presence: { allowEmpty: false },
  },
};

const uploadWdl = async (wdlFile, setWdlPayload) => {
  const rawWdl = await readFileAsText(wdlFile);
  setWdlPayload(rawWdl);
};

const NamespaceNameSection = (props: NamespaceNameSectionProps) => {
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
            Namespace
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
            Name
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

const SynopsisSnapshotSection = (props: SynopsisSnapshotSectionProps) => {
  const { synopsis, snapshotComment, setWorkflowSynopsis, setSnapshotComment, errors } = props;
  const [synopsisModified, setSynopsisModified] = useState<boolean>(false);

  const synopsisInputId = useUniqueId();
  const snapshotCommentInputId = useUniqueId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: '1.5rem' }}>
        <div style={{ marginBottom: '0.1667em' }}>
          <FormLabel htmlFor={synopsisInputId}>Synopsis (80 characters max)</FormLabel>
          <ValidatedInput
            inputProps={{
              id: synopsisInputId,
              value: synopsis,
              onChange: (v) => {
                setWorkflowSynopsis(v);
                setSynopsisModified(true);
              },
            }}
            error={Utils.summarizeErrors((synopsisModified || synopsis) && errors?.synopsis)}
          />
        </div>
      </div>
      <div style={{ paddingTop: '1.5rem' }}>
        <div style={{ marginBottom: '0.1667em' }}>
          <FormLabel htmlFor={snapshotCommentInputId}>Snapshot comment</FormLabel>
        </div>
        <TextInput id={snapshotCommentInputId} value={snapshotComment} onChange={setSnapshotComment} />
      </div>
    </div>
  );
};

const WdlBoxSection = (props: WdlBoxSectionProps) => {
  const { wdlPayload, setWdlPayload } = props;

  const wdlLabelId = useUniqueId();

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <FormLabel id={wdlLabelId} required>
          WDL
        </FormLabel>
        <Dropzone
          multiple={false}
          style={{ paddingLeft: '1rem' }}
          onDropAccepted={(wdlFile) => uploadWdl(wdlFile[0], setWdlPayload)}
        >
          {({ openUploader }) => (
            <Clickable
              style={{ color: colors.accent(1.05) }}
              aria-label='Load WDL from file'
              onClick={() => openUploader()}
            >
              Load from file
            </Clickable>
          )}
        </Dropzone>
      </div>
      <div aria-labelledby={wdlLabelId}>
        <WDLEditor wdl={wdlPayload} onChange={setWdlPayload} />
      </div>
    </>
  );
};

const DocumentationSection = (props: DocumentationSectionProps) => {
  const { documentation, setWorkflowDocumentation } = props;

  const documentationInputId = useUniqueId();

  return (
    <div style={{ paddingTop: '1.5rem' }}>
      <FormLabel htmlFor={documentationInputId}>Documentation</FormLabel>
      <TextArea
        id={documentationInputId}
        style={{ height: 100 }}
        value={documentation}
        onChange={setWorkflowDocumentation}
      />
    </div>
  );
};

/**
 * A customizable component for inputting workflow information - namespace,
 * name, WDL, documentation, synopsis, and snapshot comment - to facilitate
 * creating, editing, or cloning a method snapshot.
 */
export const WorkflowModal = (props: WorkflowModalProps) => {
  const {
    title,
    buttonActionName,
    defaultNamespace,
    defaultName,
    defaultWdl,
    defaultDocumentation,
    defaultSynopsis,
    defaultSnapshotComment,
    createMethodProvider,
    onSuccess,
    onDismiss,
  } = props;

  const [namespace, setNamespace] = useState<string>(defaultNamespace ?? '');
  const [name, setName] = useState<string>(defaultName ?? '');
  const [wdl, setWdl] = useState<string>(defaultWdl ?? '');
  const [documentation, setDocumentation] = useState<string>(defaultDocumentation ?? '');
  const [synopsis, setSynopsis] = useState<string>(defaultSynopsis ?? '');
  const [snapshotComment, setSnapshotComment] = useState<string>(defaultSnapshotComment ?? '');

  const [busy, setBusy] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<any>(null);

  const validationErrors = validate({ namespace, name, synopsis, wdl }, constraints, {
    prettify: (v) =>
      ({ namespace: 'Namespace', name: 'Name', synopsis: 'Synopsis', wdl: 'WDL' }[v] || validate.prettify(v)),
  });

  const onSubmitWorkflow = withBusyState(setBusy, async () => {
    try {
      const {
        namespace: createdWorkflowNamespace,
        name: createdWorkflowName,
        snapshotId: createdWorkflowSnapshotId,
      } = await createMethodProvider.create(namespace, name, wdl, documentation, synopsis, snapshotComment);
      onSuccess(createdWorkflowNamespace, createdWorkflowName, createdWorkflowSnapshotId);
    } catch (error) {
      setSubmissionError(error instanceof Response ? await error.text() : error);
    }
  });

  const submitWorkflowButton = (
    <ButtonPrimary
      // the same error message will not appear multiple times
      tooltip={validationErrors && _.uniqBy('props.children', Utils.summarizeErrors(validationErrors))}
      disabled={validationErrors}
      onClick={onSubmitWorkflow}
    >
      {buttonActionName}
    </ButtonPrimary>
  );

  return (
    <Modal onDismiss={onDismiss} title={title} width='75rem' okButton={submitWorkflowButton}>
      <div style={{ padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <NamespaceNameSection
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
