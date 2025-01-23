import * as _ from 'lodash/fp';
import React, { useState } from 'react';
import { div, h } from 'react-hyperscript-helpers';
import { ButtonPrimary, spinnerOverlay } from 'src/components/common';
import FooterWrapper from 'src/components/FooterWrapper';
import { TopBar } from 'src/components/TopBar';
import { Catalog } from 'src/libs/ajax/Catalog';
import {
  DataCollection,
  datasetDataUsePermissionTypes,
  DatasetMetadata,
  Publication,
  StorageObject,
  StorageSystem,
} from 'src/libs/ajax/Catalog';
import { withErrorReporting } from 'src/libs/error';
import * as Nav from 'src/libs/nav';
import * as Utils from 'src/libs/utils';
import { v4 as uuid } from 'uuid';
import { validate } from 'validate.js';

import { makeDatasetReleasePolicyDisplayInformation } from '../data-browser-utils';
import { ListInput, ListInputProps, MarkdownInput, SelectInput, StringInput } from './CreateDatasetInputs';
import { ContributorInput } from './custom-inputs/ContributorInput';
import { CountsInput } from './custom-inputs/CountsInput';
import { DataCollectionInput } from './custom-inputs/DataCollectionInput';
import { PublicationInput } from './custom-inputs/PublicationInput';
import { SamplesInput } from './custom-inputs/SamplesInput';
import { StorageInput } from './custom-inputs/StorageInput';

const constraints = {
  storageSystem: {
    presence: { allowEmpty: false },
  },
  storageSourceId: {
    presence: { allowEmpty: false },
  },
  'dct:title': {
    presence: { allowEmpty: false },
  },
  'dct:description': {
    presence: { allowEmpty: false },
  },
  'dct:creator': {
    presence: { allowEmpty: false },
  },
  'dcat:accessURL': {
    presence: { allowEmpty: false },
    url: true,
  },
};
const StorageSystemSelectInput = SelectInput as typeof SelectInput<StorageSystem>;

export interface CreateDatasetProps {
  storageSystem: StorageSystem;
  storageSourceId: string;
}

export const CreateDataset = ({ storageSystem, storageSourceId }: CreateDatasetProps) => {
  const [storageSystemState, setStorageSystemState] = useState(storageSystem);
  const [storageSourceIdState, setStorageSourceIdState] = useState(storageSourceId);
  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [creatorTouched, setCreatorTouched] = useState(false);
  const [accessURLTouched, setAccessURLTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const now = new Date().toISOString();

  const [metadata, setMetadata] = useState<DatasetMetadata>({
    'TerraCore:id': '',
    'dct:title': '',
    'dct:description': '',
    'dct:creator': '',
    'dct:issued': now,
    'dcat:accessURL': '',
    'TerraDCAT_ap:hasDataUsePermission': undefined,
    'TerraDCAT_ap:hasOriginalPublication': undefined,
    'TerraDCAT_ap:hasPublication': [],
    'TerraDCAT_ap:hasDataCollection': [],
    'TerraDCAT_ap:hasOwner': '',
    'TerraDCAT_ap:hasCustodian': [],
    'TerraDCAT_ap:hasConsentGroup': '',
    'TerraCoreValueSets:SampleType': [],
    'prov:wasAssociatedWith': [],
    'prov:wasGeneratedBy': [],
    'TerraDCAT_ap:hasGenomicDataType': [],
    'TerraDCAT_ap:hasPhenotypeDataType': [],
    storage: [],
    counts: {},
    fileAggregate: [],
    samples: {},
    contributors: [],
  });

  const errors =
    validate(
      {
        storageSystem: storageSystemState,
        storageSourceId: storageSourceIdState,
        ...metadata,
      },
      constraints
    ) || {};
  return h(FooterWrapper, {}, [
    loading && spinnerOverlay,
    h(TopBar, { title: 'Create Dataset', href: '' }, []),
    h(StorageSystemSelectInput, {
      title: 'Storage System',
      isClearable: false,
      onChange: (option) => {
        setStorageSourceIdState(option!.value === 'ext' ? uuid() : '');
        setStorageSystemState(option!.value);
      },
      placeholder: 'Enter the storage system',
      value: storageSystemState,
      required: true,
      options: [
        { label: 'Workspace', value: 'wks' },
        { label: 'TDR Snapshot', value: 'tdr' },
        { label: 'External', value: 'ext' },
      ],
    }),
    h(StringInput, {
      title: 'Storage Source Id',
      onChange: (value) => setStorageSourceIdState(value),
      value: storageSourceIdState,
      errors: errors.storageSourceId,
      placeholder: 'Enter the storage source id',
      required: true,
    }),
    h(StringInput, {
      title: 'Title',
      onChange: (value) => {
        setTitleTouched(true);
        setMetadata(_.set('dct:title', value, metadata));
      },
      value: metadata['dct:title'],
      errors: titleTouched && errors['dct:title'],
      placeholder: 'Enter a title',
      autoFocus: true,
      required: true,
    }),
    h(MarkdownInput, {
      title: 'Description',
      onChange: (value: string) => {
        setDescriptionTouched(true);
        setMetadata(_.set('dct:description', value, metadata));
      },
      value: metadata['dct:description'],
      placeholder: 'Enter a description',
      required: true,
      errors: descriptionTouched && errors['dct:description'],
    }),
    h(StringInput, {
      title: 'Dataset Creator',
      onChange: (value: string) => {
        setCreatorTouched(true);
        setMetadata(_.set('dct:creator', value, metadata));
      },
      value: metadata['dct:creator'],
      placeholder: 'Enter the creator of the dataset',
      required: true,
      errors: creatorTouched && errors['dct:creator'],
    }),
    h(StringInput, {
      title: 'Access URL',
      onChange: (value: string) => {
        setAccessURLTouched(true);
        setMetadata(_.set('dcat:accessURL', value, metadata));
      },
      value: metadata['dcat:accessURL'],
      placeholder: 'Enter the url to access the dataset',
      required: true,
      errors: accessURLTouched && errors['dcat:accessURL'],
    }),
    h(SelectInput, {
      title: 'Data Use Permission',
      onChange: (option) => setMetadata(_.set('TerraDCAT_ap:hasDataUsePermission', option!.value, metadata)),
      placeholder: 'Enter a data use permission',
      value: metadata['TerraDCAT_ap:hasDataUsePermission'],
      options: _.map((dataUsePermission) => {
        const displayInformation = makeDatasetReleasePolicyDisplayInformation(dataUsePermission);
        return {
          label: displayInformation,
          value: dataUsePermission,
        };
      }, datasetDataUsePermissionTypes),
    }),
    h(PublicationInput, {
      onChange: (value) => setMetadata(_.set('TerraDCAT_ap:hasOriginalPublication', value, metadata)),
      publication: metadata['TerraDCAT_ap:hasOriginalPublication'] || { 'dct:title': '', 'dcat:accessURL': '' },
      title: 'Original Publication',
      wrapperProps: {
        style: { width: '100%' },
      },
    }),
    h(ListInput as React.FC<ListInputProps<Publication>>, {
      title: 'Publications',
      list: metadata['TerraDCAT_ap:hasPublication'] || [],
      blankValue: { 'dct:title': '', 'dcat:accessURL': '' },
      renderer: (listItem, onChange) =>
        h(PublicationInput, {
          onChange,
          publication: listItem,
          wrapperProps: { style: { width: '95%' } },
        }),
      onChange: (value, index) => setMetadata(_.set(`TerraDCAT_ap:hasPublication[${index}]`, value, metadata)),
      onRemove: (value) =>
        setMetadata(
          _.set('TerraDCAT_ap:hasPublication', _.xor([value], metadata['TerraDCAT_ap:hasPublication']), metadata)
        ),
    }),
    h(ListInput as React.FC<ListInputProps<DataCollection>>, {
      title: 'Data Collections',
      list: metadata['TerraDCAT_ap:hasDataCollection'] || [],
      blankValue: {
        'dct:identifier': '',
        'dct:title': '',
        'dct:description': '',
        'dct:creator': '',
        'dct:publisher': '',
        'dct:issued': '',
        'dct:modified': '',
      },
      renderer: (listItem, onChange) =>
        h(DataCollectionInput, {
          onChange,
          dataCollection: listItem,
          wrapperProps: { style: { width: '95%' } },
        }),
      onChange: (value, index) => setMetadata(_.set(`TerraDCAT_ap:hasDataCollection[${index}]`, value, metadata)),
      onRemove: (value) =>
        setMetadata(
          _.set('TerraDCAT_ap:hasDataCollection', _.xor([value], metadata['TerraDCAT_ap:hasDataCollection']), metadata)
        ),
    }),
    h(CountsInput, {
      title: 'Counts',
      counts: metadata.counts,
      onChange: (value) => setMetadata(_.set('counts', value, metadata)),
    }),
    h(SamplesInput, {
      title: 'Samples',
      samples: metadata.samples,
      onChange: (value) => setMetadata(_.set('samples', value, metadata)),
    }),
    h(ListInput, {
      title: 'Contributors',
      list: metadata.contributors || [],
      blankValue: { name: '', email: '', additionalInformation: {} },
      renderer: (listItem, onChange) =>
        h(ContributorInput, {
          onChange,
          contributor: listItem,
          title: undefined,
          wrapperProps: { style: { width: '95%' } },
        }),
      onChange: (value, index) => setMetadata(_.set(`contributors[${index}]`, value, metadata)),
      onRemove: (value) => setMetadata(_.set('contributors', _.xor([value], metadata.contributors), metadata)),
    }),
    h(ListInput as React.FC<ListInputProps<StorageObject>>, {
      title: 'Storage',
      list: metadata.storage || [],
      blankValue: { cloudPlatform: undefined, cloudResource: undefined, region: undefined },
      renderer: (listItem, onChange) =>
        h(StorageInput, {
          onChange,
          storageObject: listItem,
          wrapperProps: { style: { width: '95%' } },
        }),
      onChange: (value, index) => setMetadata(_.set(`storage[${index}]`, value, metadata)),
      onRemove: (value) => setMetadata(_.set('storage', _.xor([value], metadata.storage), metadata)),
    }),
    div({ style: { display: 'flex', justifyContent: 'flex-end' } }, [
      div({ style: { display: 'flex', justifyContent: 'flex-end', margin: '1rem' } }, [
        h(
          ButtonPrimary,
          {
            style: { marginLeft: '1rem' },
            disabled: _.keys(errors).length > 0,
            tooltip: Utils.summarizeErrors(errors),
            onClick: () => {
              _.flow(
                withErrorReporting('Error creating dataset'),
                Utils.withBusyState(setLoading)
              )(async () => {
                const response = await (
                  await Catalog().upsertDataset(storageSystemState, storageSourceIdState, metadata)
                ).json();
                Nav.goToPath('library-details', { id: response.id });
              })();
            },
          },
          ['Create']
        ),
      ]),
    ]),
  ]);
};
