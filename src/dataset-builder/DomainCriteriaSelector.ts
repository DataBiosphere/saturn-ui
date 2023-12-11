import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { spinnerOverlay } from 'src/components/common';
import { getNextCriteriaIndex } from 'src/dataset-builder/CohortEditor';
import { SnapshotBuilderConcept as Concept, SnapshotBuilderDomainOption as DomainOption } from 'src/libs/ajax/DataRepo';
import { DatasetBuilder, DomainCriteria, GetConceptsResponse } from 'src/libs/ajax/DatasetBuilder';
import { useLoadedData } from 'src/libs/ajax/loaded-data/useLoadedData';
import { useOnMount } from 'src/libs/react-utils';

import { ConceptSelector } from './ConceptSelector';
import { cohortEditorState, DomainCriteriaSelectorState } from './dataset-builder-types';
import { OnStateChangeHandler } from './DatasetBuilder';

interface DomainCriteriaSelectorProps {
  readonly state: DomainCriteriaSelectorState;
  readonly onStateChange: OnStateChangeHandler;
}

export const toCriteria =
  (domainOption: DomainOption) =>
  (concept: Concept): DomainCriteria => {
    return {
      kind: 'domain',
      name: concept.name,
      id: concept.id,
      index: getNextCriteriaIndex(),
      count: concept.count,
      domainOption,
    };
  };

export const DomainCriteriaSelector = (props: DomainCriteriaSelectorProps) => {
  const [rootConcepts, loadRootConcepts] = useLoadedData<GetConceptsResponse>();
  const { state, onStateChange } = props;
  useOnMount(() => {
    void loadRootConcepts(() => DatasetBuilder().getConcepts(state.domainOption.root));
  });
  return rootConcepts.status === 'Ready'
    ? h(ConceptSelector, {
        initialRows: rootConcepts.state.result,
        title: state.domainOption.category,
        onCancel: () => onStateChange(cohortEditorState.new(state.cohort)),
        onCommit: (selected: Concept[]) => {
          const cartCriteria = _.map(toCriteria(state.domainOption), selected);
          const groupIndex = _.findIndex({ name: state.criteriaGroup.name }, state.cohort.criteriaGroups);
          // add/remove all cart elements to the domain group's criteria list in the cohort
          _.flow(
            _.update(`criteriaGroups.${groupIndex}.criteria`, _.xor(cartCriteria)),
            cohortEditorState.new,
            onStateChange
          )(state.cohort);
        },
        actionText: 'Add to group',
      })
    : spinnerOverlay;
};
