import { ButtonPrimary, Clickable, useUniqueId } from '@terra-ui-packages/components';
import { readFileAsText } from '@terra-ui-packages/core-utils';
import _ from 'lodash/fp';
import React, { useState } from 'react';
import Dropzone from 'src/components/Dropzone';
import { TextArea, TextInput, ValidatedInput } from 'src/components/input';
import colors from 'src/libs/colors';
import { FormLabel } from 'src/libs/forms';
import * as Utils from 'src/libs/utils';
import { WDLEditor } from 'src/workflows/methods/WDLEditor';

export interface WorkflowModalCommonProps {
  /** The title to be shown at the top of the modal. */
  title: string;

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

interface SubmitWorkflowModalButtonProps {
  buttonActionName: string;
  validationErrors: string | undefined;
  onSubmitWorkflow: () => void;
}

export const workflowModalCommonConstraints = {
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

export const SynopsisSnapshotSection = (props: SynopsisSnapshotSectionProps) => {
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

export const WdlBoxSection = (props: WdlBoxSectionProps) => {
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

export const DocumentationSection = (props: DocumentationSectionProps) => {
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

export const SubmitWorkflowModalButton = (props: SubmitWorkflowModalButtonProps) => {
  const { buttonActionName, validationErrors, onSubmitWorkflow } = props;

  return (
    <ButtonPrimary
      // the same error message will not appear multiple times
      tooltip={validationErrors && _.uniqBy('props.children', Utils.summarizeErrors(validationErrors))}
      disabled={!!validationErrors}
      onClick={onSubmitWorkflow}
    >
      {buttonActionName}
    </ButtonPrimary>
  );
};
