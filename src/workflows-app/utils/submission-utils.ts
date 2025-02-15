import _ from 'lodash/fp';
import { div } from 'react-hyperscript-helpers';
import { icon } from 'src/components/icons';
import { statusType as jobStatusType } from 'src/components/job-common';
import colors from 'src/libs/colors';
import * as Utils from 'src/libs/utils';
import { differenceFromDatesInSeconds, differenceFromNowInSeconds, maybeParseJSON } from 'src/libs/utils';
import { WorkflowTableColumnNames } from 'src/libs/workflow-utils';
import {
  InputDefinition,
  InputSource,
  InputType,
  OptionalInputType,
  OutputDefinition,
  OutputDestination,
  OutputType,
  PrimitiveInputType,
  StructInputDefinition,
  StructInputType,
  WorkflowInputDefinition,
} from 'src/workflows-app/models/submission-models';

export const AutoRefreshInterval = 1000 * 60; // 1 minute
export const WdsPollInterval = 1000 * 30; // 30 seconds
export const CbasPollInterval = 1000 * 30; // 30 seconds

export const CbasDefaultSubmissionLimits = {
  maxWorkflows: 100,
  maxInputs: 200,
  maxOutputs: 300,
};

export type InputTableData = {
  configurationIndex: number;
  inputTypeStr: string;
  inputName: string;
  inputType: InputType;
  optional: boolean;
  source: InputSource;
  taskName: string;
  variable: string;
};

export type OutputTableData = {
  configurationIndex: number;
  destination: OutputDestination;
  outputTypeStr: string;
  outputName: string;
  outputType: OutputType;
  taskName: string;
  variable: string;
};

const iconSize = 24;
export const addCountSuffix = (label, count = undefined) => {
  return label + (count === undefined ? '' : `: ${count}`);
};

export const statusType = {
  ...jobStatusType,
  canceling: {
    id: 'canceling', // Must match variable name for collection unpacking.
    label: () => 'Canceling',
    icon: (style) => icon('sync', { size: iconSize, style: { color: colors.dark(), ...style } }),
  },
  canceled: {
    id: 'canceled', // Must match variable name for collection unpacking.
    label: () => 'Canceled',
    icon: (style) => icon('warning-standard', { size: iconSize, style: { color: colors.dark(), ...style } }),
  },
  queued: {
    id: 'queued',
    label: () => 'Queued',
    icon: (style) => icon('clock', { size: iconSize, style: { color: colors.dark(), ...style } }),
  },
};

/**
 * Returns the rendered status line, based on icon function, label, and style.
 */
export const makeStatusLine = (iconFn, label, style) =>
  div({ style: { display: 'flex', alignItems: 'center', fontSize: 14, ...style } }, [
    iconFn({ marginRight: '0.5rem' }),
    label,
  ]);

const RunSetTerminalStates = ['ERROR', 'COMPLETE', 'CANCELED'];
export const isRunSetInTerminalState = (runSetStatus) => RunSetTerminalStates.includes(runSetStatus);

const RunTerminalStates = ['COMPLETE', 'CANCELED', 'SYSTEM_ERROR', 'ABORTED', 'EXECUTOR_ERROR'];
export const isRunInTerminalState = (runStatus) => RunTerminalStates.includes(runStatus);

export const getDuration = (state, submissionDate, lastModifiedTimestamp, stateCheckCallback) => {
  return stateCheckCallback(state)
    ? differenceFromDatesInSeconds(submissionDate, lastModifiedTimestamp)
    : differenceFromNowInSeconds(submissionDate);
};

export const parseMethodString = (methodString: string) => {
  const methodNameParts = methodString.split('.');
  return {
    workflow: methodNameParts[0],
    call: methodNameParts.length === 3 ? methodNameParts[1] : '',
    variable: methodNameParts[methodNameParts.length - 1],
  };
};

export const parseAttributeName = (attributeName) => {
  const namespaceDelimiterIndex = _.lastIndexOf(':', attributeName);
  const columnName = attributeName.slice(namespaceDelimiterIndex + 1);
  const columnNamespace = attributeName.slice(0, namespaceDelimiterIndex + 1);
  return { columnNamespace, columnName };
};

// Use output definition if it has been run before or if the template contains non-none destinations
// Otherwise we will autofill all outputs to default.
export const autofillOutputDef = (outputDef, runCount) => {
  const jsonParsedOutput = maybeParseJSON(outputDef) as OutputDefinition[];
  const shouldUseOutputs = runCount > 0 || jsonParsedOutput.some((outputDef) => outputDef.destination.type !== 'none');
  return shouldUseOutputs
    ? jsonParsedOutput
    : jsonParsedOutput.map((outputDef) => ({
        ...outputDef,
        destination: {
          type: 'record_update',
          record_attribute: parseMethodString(outputDef.output_name).variable || '',
        },
      }));
};

export const inputSourceLabels = {
  literal: 'Type a Value',
  record_lookup: 'Fetch from Data Table',
  object_builder: 'Use Struct Builder',
  none: 'None',
};

export const inputSourceTypes = _.invert(inputSourceLabels);

export const inputTypeParamDefaults = {
  literal: () => ({ parameter_value: '' }),
  record_lookup: () => ({ record_attribute: '' }),
  object_builder: (inputType: InputType) => ({
    fields: asStructType(inputType).fields.map((field) => ({ name: field.field_name, source: { type: 'none' } })),
  }),
};

export const isInputOptional = (ioType: InputType): ioType is OptionalInputType => ioType.type === 'optional';

export const inputTypeStyle = (iotype: InputType) => {
  if (isInputOptional(iotype)) {
    return { fontStyle: 'italic' };
  }
  return {};
};

export const renderTypeText = (iotype: InputType): string => {
  if (iotype.type === 'primitive') {
    return iotype.primitive_type;
  }
  if (iotype.type === 'optional') {
    return renderTypeText(iotype.optional_type);
  }
  if (iotype.type === 'array') {
    return `Array[${renderTypeText(iotype.array_type)}]`;
  }
  if (iotype.type === 'map') {
    return `Map[${iotype.key_type}, ${renderTypeText(iotype.value_type)}]`;
  }
  if (iotype.type === 'struct') {
    return 'Struct';
  }
  return 'Unsupported Type';
};

export const unwrapOptional = (input: InputType): Exclude<InputType, OptionalInputType> =>
  input.type === 'optional' ? input.optional_type : input;

export const asStructType = (input: InputType): StructInputType => {
  const unwrapped = unwrapOptional(input);
  if (unwrapped.type === 'struct') {
    return unwrapped as StructInputType;
  }
  throw new Error('Not a struct');
};

type InputValidation =
  | {
      type: 'error' | 'info' | 'success';
      message: string;
    }
  | {
      type: 'none';
    };

type IsInputValid =
  | true
  | {
      type: 'error' | 'info' | 'success';
      message: string;
    };

export type InputValidationWithName = InputValidation & {
  name: string;
};

const inputValueRequiredMessage = `This ${WorkflowTableColumnNames.INPUT_VALUE.toLowerCase()} is required`;

const validateRequiredHasSource = (inputSource: InputSource, inputType: InputType): IsInputValid => {
  if (inputType.type === 'optional') {
    return true;
  }

  if (!inputSource) {
    return { type: 'error', message: inputValueRequiredMessage };
  }

  if (inputSource.type === 'none') {
    return { type: 'error', message: inputValueRequiredMessage };
  }
  if (inputSource.type === 'object_builder' && inputType.type === 'struct') {
    const sourceFieldsFilled = _.flow(
      _.toPairs,
      _.map(([idx, _field]) => inputSource.fields[idx] || { source: { type: 'none' } })
    )(inputType.fields);

    const fieldsValidated = _.map(
      (field: StructInputDefinition) => validateRequiredHasSource(field.source, field.field_type) === true,
      _.merge(sourceFieldsFilled, inputType.fields)
    );
    return _.every(Boolean, fieldsValidated) || { type: 'error', message: 'This struct is missing a required input' };
  }
  if (inputSource.type === 'literal') {
    // this condition is specifically added to allow '' and '0' and 'false' as valid values because
    // '!!inputSource.parameter_value' considers '0' and 'false' as empty values
    // Note: '!=' null check also covers if value is undefined
    if (
      inputSource.parameter_value != null &&
      (inputSource.parameter_value === 0 || inputSource.parameter_value === false || inputSource.parameter_value === '')
    ) {
      return true;
    }

    return !!inputSource.parameter_value || { type: 'error', message: inputValueRequiredMessage };
  }
  if (inputSource.type === 'record_lookup' && inputSource.record_attribute === '') {
    return { type: 'error', message: inputValueRequiredMessage };
  }
  return true;
};

export const typeMatch = (cbasType: InputType, wdsType): boolean => {
  const unwrappedCbasType = unwrapOptional(cbasType);
  if (unwrappedCbasType.type === 'primitive') {
    return Utils.switchCase(
      unwrappedCbasType.primitive_type,
      ['Int', () => wdsType === 'NUMBER'],
      ['Float', () => wdsType === 'NUMBER'],
      ['Boolean', () => wdsType === 'BOOLEAN'],
      ['File', () => wdsType === 'FILE' || wdsType === 'STRING'],
      [Utils.DEFAULT, () => true]
    );
  }
  if (unwrappedCbasType.type === 'array') {
    // should match single values as well as array values
    return typeMatch(unwrappedCbasType.array_type, _.replace('ARRAY_OF_', '')(wdsType));
  }
  if (unwrappedCbasType.type === 'struct') {
    return wdsType === 'JSON';
  }
  return true;
};

const validateRecordLookup = (
  inputSource: InputSource | undefined,
  inputType: InputType,
  recordAttributes
): IsInputValid => {
  if (!inputSource) {
    return true;
  }
  if (inputSource.type === 'record_lookup') {
    if (recordAttributes === undefined) {
      return { type: 'error', message: 'Select a data table' };
    }
    if (!_.has(inputSource.record_attribute)(recordAttributes)) {
      return { type: 'error', message: "This attribute doesn't exist in the data table" };
    }
    if (!typeMatch(inputType, _.get(`${inputSource.record_attribute}.datatype`)(recordAttributes))) {
      return { type: 'error', message: 'Provided type does not match expected type' };
    }
    if (
      unwrapOptional(inputType).type === 'array' &&
      !_.startsWith('ARRAY_OF_')(_.get(`${inputSource.record_attribute}.datatype`)(recordAttributes))
    ) {
      return { type: 'info', message: 'Single value column will be coerced to an array' };
    }
    return true;
  }
  if (inputSource.type === 'object_builder' && inputType.type === 'struct') {
    if (inputSource.fields && inputType.fields) {
      const fieldsValidated = _.map(
        (field: StructInputDefinition) =>
          field && validateRecordLookup(field.source, field.field_type, recordAttributes) === true,
        _.merge(inputType.fields, inputSource.fields)
      );
      return (
        _.every(Boolean, fieldsValidated) || {
          type: 'error',
          message: "One of this struct's inputs has an invalid configuration",
        }
      );
    }
    return { type: 'error', message: "One of this struct's inputs has an invalid configuration" };
  }
  return true;
};

// Note: this conversion function is called only after checking that values being converted are valid.
//       Hence we don't check the validity of inputs here
export const convertToPrimitiveType = (primitiveType: PrimitiveInputType['primitive_type'], value) => {
  return Utils.cond<number | string | boolean>(
    [primitiveType === 'Int', () => parseInt(value)],
    [primitiveType === 'Float', () => parseFloat(value)],
    [primitiveType === 'Boolean' && typeof value !== 'boolean', () => value === 'true'],
    () => value
  );
};

export const isPrimitiveTypeInputValid = (primitiveType: PrimitiveInputType['primitive_type'], value): boolean => {
  return Utils.cond(
    // last condition ensures empty strings are not accepted as valid Int because Number(value) in second condition converts empty strings to 0
    [
      primitiveType === 'Int',
      () => !Number.isNaN(value) && Number.isInteger(Number(value)) && !Number.isNaN(parseInt(value)),
    ],
    [
      primitiveType === 'Float',
      () => !Number.isNaN(value) && !Number.isNaN(Number(value)) && !Number.isNaN(parseFloat(value)),
    ],
    [
      primitiveType === 'Boolean',
      () => value.toString().toLowerCase() === 'true' || value.toString().toLowerCase() === 'false',
    ],
    () => true
  );
};

export const convertInputTypes = ({
  input_type: inputType,
  source: inputSource,
  ...input
}: Omit<InputDefinition, 'input_name'>): Omit<InputDefinition, 'input_name'> => {
  const unwrappedInput = unwrapOptional(inputType);
  if (unwrappedInput.type === 'array' && inputSource.type === 'literal') {
    const innerType = unwrapOptional(unwrappedInput.array_type);
    let value = inputSource.parameter_value;
    if (!Array.isArray(value)) {
      try {
        value = JSON.parse(inputSource.parameter_value);
        if (!Array.isArray(value)) {
          value = [value];
        }
      } catch (e) {
        value = [value];
      }
    }
    if (innerType.type === 'primitive') {
      value = _.map((element) => convertToPrimitiveType(innerType.primitive_type, element))(value);
    }
    return { ...input, input_type: inputType, source: { ...inputSource, parameter_value: value } };
  }
  if (unwrappedInput.type === 'struct' && inputSource.type === 'object_builder') {
    return {
      ...input,
      input_type: inputType,
      source: {
        ...inputSource,
        fields: _.map((field: StructInputDefinition) => ({
          name: field.name,
          source: convertInputTypes({ input_type: field.field_type, source: field.source }).source,
        }))(_.merge(inputSource.fields, unwrappedInput.fields)),
      },
    };
  }
  if (inputSource.type === 'literal' && unwrappedInput.type === 'primitive') {
    return {
      ...input,
      input_type: inputType,
      source: {
        type: inputSource.type,
        parameter_value: convertToPrimitiveType(unwrappedInput.primitive_type, inputSource.parameter_value),
      },
    };
  }
  return { ...input, input_type: inputType, source: inputSource };
};

const validatePrimitiveLiteral = (inputSource, inputType): IsInputValid => {
  if (inputSource.parameter_value === '' && inputType.primitive_type === 'String') {
    return { type: 'info', message: 'This will be sent as an empty string' };
  }
  if (inputSource.parameter_value === '') {
    return { type: 'error', message: 'Value is empty' };
  }
  return (
    isPrimitiveTypeInputValid(inputType.primitive_type, inputSource.parameter_value) || {
      type: 'error',
      message: "Value doesn't match expected input type",
    }
  );
};

const validateArrayLiteral = (inputSource, inputType): IsInputValid => {
  let value = inputSource.parameter_value;
  if (value === '') {
    return {
      type: 'error',
      message:
        'Array inputs should follow JSON array literal syntax. This input is empty. To submit an empty array, enter []',
    };
  }
  const singletonValidation: IsInputValid =
    validateLiteralInput(inputSource, inputType.array_type) === true
      ? {
          type: 'info',
          message: `Array inputs should follow JSON array literal syntax. This will be submitted as an array with one value: ${JSON.stringify(
            inputSource.parameter_value
          )}`,
        }
      : { type: 'error', message: 'Array inputs should follow JSON array literal syntax. This input cannot be parsed' };

  try {
    if (!Array.isArray(inputSource.parameter_value)) {
      value = JSON.parse(inputSource.parameter_value);
    }
  } catch (e) {
    return singletonValidation;
  }
  if (!Array.isArray(value)) {
    return {
      type: 'info',
      message: `Array inputs should follow JSON array literal syntax. This will be submitted as an array with one value: ${inputSource.parameter_value}`,
    };
  }
  if (value.length === 0 && inputType.non_empty) {
    return { type: 'error', message: 'This array cannot be empty' };
  }
  return _.every(
    (arrayElement) =>
      validateLiteralInput({ ...inputSource, parameter_value: arrayElement }, unwrapOptional(inputType.array_type)) ===
      true
  )(value)
    ? { type: 'success', message: `Successfully detected an array with ${value.length} element(s).` }
    : { type: 'error', message: 'One or more of the values in the array does not match the expected type' };
};

const validateLiteralInput = (inputSource: InputSource, inputType: InputType) => {
  if (!inputSource) {
    return true;
  }

  const unwrappedInputType = unwrapOptional(inputType);

  // for user entered values and inputs that have primitive type, we validate that value matches expected type
  if (inputSource.type === 'literal' && unwrappedInputType.type === 'primitive') {
    return validatePrimitiveLiteral(inputSource, unwrappedInputType);
  }

  if (inputSource.type === 'literal' && unwrappedInputType.type === 'array') {
    return validateArrayLiteral(inputSource, unwrappedInputType);
  }

  if (inputSource.type === 'literal') {
    return { type: 'error', message: 'Input type does not support literal input' };
  }

  // for object_builder source type, we check that each field with user entered values and inputs that have
  // primitive type have values that match the expected input type
  if (inputSource.type === 'object_builder' && inputSource.fields && inputType.type === 'struct') {
    const fieldsValidated = _.map(
      (field: StructInputDefinition) => field && validateLiteralInput(field.source, field.field_type),
      _.merge(inputSource.fields, inputType.fields)
    );
    return (
      _.every(Boolean, fieldsValidated) || {
        type: 'error',
        message: "One of this struct's inputs has an invalid configuration",
      }
    );
  }

  return true;
};

const validateInput = (input: WorkflowInputDefinition, dataTableAttributes): InputValidation => {
  const inputType = 'input_type' in input ? input.input_type : input.field_type;
  // first validate that required inputs have a source
  const requiredHasSource = validateRequiredHasSource(input.source, inputType);
  if (requiredHasSource !== true) {
    return requiredHasSource;
  }
  // then validate that record lookups are good (exist in table)
  const validRecordLookup = validateRecordLookup(input.source, inputType, dataTableAttributes);
  if (validRecordLookup !== true) {
    return validRecordLookup;
  }
  // then validate that literal inputs are good (have correct type)
  const validLiteralInput = validateLiteralInput(input.source, inputType);
  if (validLiteralInput !== true) {
    return validLiteralInput;
  }
  // otherwise no errors!
  return { type: 'none' };
};

export const validateInputs = (
  inputDefinition: WorkflowInputDefinition[],
  dataTableAttributes
): InputValidationWithName[] =>
  inputDefinition.map((input) => {
    const inputMessage = validateInput(input, dataTableAttributes);
    return { name: 'input_name' in input ? input.input_name : input.field_name, ...inputMessage };
  });

export const getInputTableData = (
  configuredInputDefinition: InputDefinition[],
  searchFilter: string,
  includeOptionalInputs: boolean,
  inputTableSort: { field: string; direction: boolean | 'asc' | 'desc' }
): InputTableData[] => {
  return _.flow(
    Utils.toIndexPairs,
    _.map(([index, row]: [number, InputDefinition]): InputTableData => {
      const { workflow, call, variable } = parseMethodString(row.input_name);
      return {
        taskName: call || workflow || '',
        variable: variable || '',
        inputTypeStr: renderTypeText(row.input_type),
        inputName: row.input_name,
        inputType: row.input_type,
        configurationIndex: index,
        optional: isInputOptional(row.input_type),
        ...row,
      };
    }),
    _.orderBy<InputTableData>(
      [
        'optional',
        // @ts-expect-error
        ({ [inputTableSort.field]: field }) => _.lowerCase(field),
        ({ taskName }) => _.lowerCase(taskName),
        ({ variable }) => _.lowerCase(variable),
      ],
      ['asc', inputTableSort.direction, 'asc', 'asc']
    ),
    _.filter((row: InputTableData) => {
      return (
        (includeOptionalInputs || !row.optional) &&
        (row.taskName.toLocaleLowerCase().includes(searchFilter.toLocaleLowerCase()) ||
          row.variable.toLocaleLowerCase().includes(searchFilter.toLocaleLowerCase()))
      );
    })
  )(configuredInputDefinition);
};

export const getOutputTableData = (
  configuredOutputDefinition: OutputDefinition[],
  sort: { field: string; direction: string }
): OutputTableData[] => {
  return _.flow(
    Utils.toIndexPairs,
    _.map(([index, row]: [number, OutputDefinition]) => {
      const { workflow, call, variable } = parseMethodString(row.output_name);
      return {
        ...row,
        taskName: call || workflow || '',
        variable: variable || '',
        outputTypeStr: renderTypeText(row.output_type),
        configurationIndex: index,
      };
    }),
    // @ts-expect-error
    _.orderBy([({ [sort.field]: field }) => _.lowerCase(field)], [sort.direction])
  )(configuredOutputDefinition);
};
