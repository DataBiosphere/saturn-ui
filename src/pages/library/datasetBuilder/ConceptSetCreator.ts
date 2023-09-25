import _ from 'lodash/fp';
import { h } from 'react-hyperscript-helpers';
import { DatasetModel, SnapshotBuilderConcept as Concept } from 'src/libs/ajax/DataRepo';
import { ConceptSet } from 'src/libs/ajax/DatasetBuilder';
import { ConceptSelector } from 'src/pages/library/datasetBuilder/ConceptSelector';
import { homepageState, Updater } from 'src/pages/library/datasetBuilder/dataset-builder-types';
import { OnStateChangeHandler } from 'src/pages/library/datasetBuilder/DatasetBuilder';

export type ConceptSetCreatorProps = {
  readonly onStateChange: OnStateChangeHandler;
  readonly datasetDetails: DatasetModel;
  readonly conceptSetUpdater: Updater<ConceptSet[]>;
};

export const toConceptSet = (concept: Concept): ConceptSet => {
  return {
    name: concept.name,
    featureValueGroupName: concept.name,
  };
};

export const ConceptSetCreator = (props: ConceptSetCreatorProps) => {
  const { onStateChange, datasetDetails, conceptSetUpdater } = props;
  return h(ConceptSelector, {
    initialRows: _.map(_.get('root'), datasetDetails?.snapshotBuilderSettings?.domainOptions),
    title: 'Add concept',
    onCancel: () => onStateChange(homepageState.new()),
    onCommit: (selected: Concept[]) => {
      conceptSetUpdater((conceptSets) => _.flow(_.map(toConceptSet), _.union(conceptSets))(selected));
      onStateChange(homepageState.new());
    },
    actionText: 'Add to concept sets',
  });
};
