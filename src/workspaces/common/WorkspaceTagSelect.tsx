import debouncePromise from 'debounce-promise';
import _ from 'lodash/fp';
import React from 'react';
import { AsyncCreatableSelect } from 'src/components/common';
import { WorkspaceTag } from 'src/libs/ajax/workspaces/workspace-models';
import { Workspaces } from 'src/libs/ajax/workspaces/Workspaces';
import { withErrorReporting } from 'src/libs/error';
import { useCancellation, useInstance } from 'src/libs/react-utils';

export type WorkspaceTagSelectProps<IsMulti extends boolean> = React.ComponentProps<
  typeof AsyncCreatableSelect<{ value: string; label?: string }, IsMulti>
>;

interface WorkspaceTagSelectOption {
  value: string;
  label: string;
}

export const WorkspaceTagSelect = <isMulti extends boolean>(props: WorkspaceTagSelectProps<isMulti>) => {
  const signal = useCancellation();
  const getTagSuggestions = useInstance(() =>
    debouncePromise(
      withErrorReporting('Error loading tags')(async (text: string) => {
        return _.map((matchingTag: WorkspaceTag): WorkspaceTagSelectOption => {
          const { tag, count } = matchingTag;
          return { value: tag, label: `${tag} (${count})` };
        }, await Workspaces(signal).getTags(text, 10));
      }),
      250
    )
  );
  return <AsyncCreatableSelect allowCreateWhileLoading defaultOptions loadOptions={getTagSuggestions} {...props} />;
};
