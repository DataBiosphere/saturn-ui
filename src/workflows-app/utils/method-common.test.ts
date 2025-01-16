import { Dockstore, DockstoreContract } from 'src/libs/ajax/Dockstore';
import { asMockedFn, MockedFn, partial } from 'src/testing/test-utils';
import {
  convertToRawUrl,
  getMethodVersionName,
  getSortableRunSets,
  isCovid19Method,
  samIdToWorkspaceNickname,
} from 'src/workflows-app/utils/method-common';

jest.mock('src/libs/config', () => ({
  ...jest.requireActual('src/libs/config'),
  getConfig: jest.fn().mockReturnValue({}),
}));

jest.mock('src/libs/ajax/Dockstore');
jest.mock('src/libs/ajax/workflows-app/Cbas');

describe('isCovid19Method', () => {
  const testCases = [
    { methodName: 'fetch_sra_to_bam', expectedResult: true },
    { methodName: 'assemble_refbased', expectedResult: true },
    { methodName: 'sarscov2_nextstrain', expectedResult: true },
    { methodName: 'my_workflow', expectedResult: false },
  ];

  test.each(testCases)('returns $expectedResult for method $methodName', ({ methodName, expectedResult }) => {
    expect(isCovid19Method(methodName)).toBe(expectedResult);
  });
});

describe('convertToRawUrl', () => {
  const nonDockstoreValidTestCases = [
    // "GitHub" as source
    {
      methodPath:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      methodVersion: 'develop',
      methodSource: 'GitHub',
      expectedRawUrl:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
    },
    {
      methodPath:
        'https://github.com/broadinstitute/cromwell/blob/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      methodVersion: 'develop',
      methodSource: 'GitHub',
      expectedRawUrl:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
    },
    // "Github" as source
    {
      methodPath:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      methodVersion: 'develop',
      methodSource: 'Github',
      expectedRawUrl:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
    },
    {
      methodPath:
        'https://github.com/broadinstitute/cromwell/blob/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      methodVersion: 'develop',
      methodSource: 'Github',
      expectedRawUrl:
        'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
    },
  ];

  test.each(nonDockstoreValidTestCases)(
    'returns raw URL for GitHub source',
    ({ methodPath, methodVersion, methodSource, expectedRawUrl }) => {
      expect(convertToRawUrl(methodPath, methodVersion, methodSource)).toBe(expectedRawUrl);
    }
  );

  it('should call Dockstore to retrieve raw URL', async () => {
    const methodPath = 'github.com/broadinstitute/viral-pipelines/fetch_sra_to_bam';
    const methodVersion = 'master';
    const methodSource = 'Dockstore';
    const rawUrl =
      'https://raw.githubusercontent.com/broadinstitute/viral-pipelines/master/pipes/WDL/workflows/fetch_sra_to_bam.wdl';

    const mockDockstoreWfSourceMethod: MockedFn<DockstoreContract['getWorkflowSourceUrl']> = jest.fn(
      async (_path, _version) => rawUrl
    );

    asMockedFn(Dockstore).mockReturnValue(
      partial<DockstoreContract>({
        getWorkflowSourceUrl: mockDockstoreWfSourceMethod,
      })
    );

    const actualUrl = await convertToRawUrl(methodPath, methodVersion, methodSource);

    expect(mockDockstoreWfSourceMethod).toBeCalledTimes(1);
    expect(mockDockstoreWfSourceMethod).toHaveBeenCalledWith(methodPath, methodVersion);
    expect(actualUrl).toBe(rawUrl);
  });

  it('should throw error for unknown method source', () => {
    const methodPath = 'https://my-website/hello-world.wdl';
    const methodVersion = 'develop';
    const methodSource = 'MySource';

    try {
      convertToRawUrl(methodPath, methodVersion, methodSource);
    } catch (e: any) {
      expect(e.message).toBe(
        "Unknown method source 'MySource'. Currently supported method sources are [GitHub, Dockstore]."
      );
    }
  });
});

describe('getMethodVersionName in ImportGithub component', () => {
  // testing various methods living at different depths of directory trees to ensure accuracy of getMethodVersionName()
  const testUrls = [
    {
      url: 'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wdl/transforms/draft3/src/test/cases/simple_task.wdl',
      expectedVersion: 'develop',
    },
    {
      url: 'https://github.com/broadinstitute/warp/blob/Imputation_v1.1.1/pipelines/broad/arrays/imputation/Imputation.wdl',
      expectedVersion: 'Imputation_v1.1.1',
    },
    {
      url: 'https://github.com/DataBiosphere/topmed-workflows/tree/1.32.0/aligner/functional-equivalence-wdl/FunctionalEquivalence.wdl',
      expectedVersion: '1.32.0',
    }, // from dockstore
    {
      url: 'https://github.com/broadinstitute/cromwell/blob/develop/wom/src/test/resources/command_parameters/test.wdl',
      expectedVersion: 'develop',
    },
    {
      url: 'https://raw.githubusercontent.com/broadinstitute/cromwell/develop/wom/src/test/resources/wc.wdl',
      expectedVersion: 'develop',
    },
    {
      url: 'https://raw.githubusercontent.com/broadinstitute/warp/VariantCalling_v2.1.2/pipelines/broad/dna_seq/germline/variant_calling/VariantCalling.wdl',
      expectedVersion: 'VariantCalling_v2.1.2',
    },
    {
      url: 'https://github.com/broadinstitute/warp/blob/AnnotationFiltration_v1.2.4/pipelines/broad/annotation_filtration/AnnotationFiltration.wdl',
      expectedVersion: 'AnnotationFiltration_v1.2.4',
    },
    {
      url: 'https://raw.githubusercontent.com/broadinstitute/warp/AnnotationFiltration_v1.2.4/pipelines/broad/annotation_filtration/AnnotationFiltration.wdl',
      expectedVersion: 'AnnotationFiltration_v1.2.4',
    },
    {
      url: 'https://github.com/broadinstitute/warp/blob/scATAC_v1.3.0/tasks/skylab/HISAT2.wdl',
      expectedVersion: 'scATAC_v1.3.0',
    },
    {
      url: 'https://raw.githubusercontent.com/broadinstitute/cromwell/54/wom/src/test/resources/command_parameters/test.wdl',
      expectedVersion: '54',
    },
  ];

  test.each(testUrls)('returns expected version for url', ({ url, expectedVersion }) => {
    expect(getMethodVersionName(url)).toBe(expectedVersion);
  });
});

describe('add submitter_priority field to enable sorting by submitter', () => {
  const ownId = '2654885223328825f67e1';
  const testRunSets = [
    { user_id: '2649769319098f1d7cae2', a_run_set_field: 123, a_nested_field: { message: 'hello world' } },
    { user_id: '26497726685082cc6be53', a_run_set_field: 345, a_nested_field: { message: 'hello new york' } },
    { user_id: ownId, a_run_set_field: 456, a_nested_field: { message: 'foo bar baz' } },
  ];
  it('should add the submitter_priority field to each run set entry', () => {
    const sortableRunSets = getSortableRunSets(testRunSets, ownId);
    expect(sortableRunSets[0]).toHaveProperty('submitter_priority');
    expect(sortableRunSets[1]).toHaveProperty('submitter_priority');
    expect(sortableRunSets[2]).toHaveProperty('submitter_priority', -1);

    const expectedProperties = ['user_id', 'a_run_set_field', 'a_nested_field'];
    expectedProperties.forEach((prop) => expect(sortableRunSets[0]).toHaveProperty(prop));
    expectedProperties.forEach((prop) => expect(sortableRunSets[1]).toHaveProperty(prop));
    expectedProperties.forEach((prop) => expect(sortableRunSets[2]).toHaveProperty(prop));

    expect(sortableRunSets[0].a_nested_field).toHaveProperty('message', 'hello world');
    expect(sortableRunSets[1].a_nested_field).toHaveProperty('message', 'hello new york');
    expect(sortableRunSets[2].a_nested_field).toHaveProperty('message', 'foo bar baz');
  });
});

describe('test workspace nicknames for deterministic ordering', () => {
  const expectedNicknames = [
    {
      samId: '2649769319098f1d7cae2',
      nickname: 'priceless dalmatian',
    },
    {
      samId: '26497726685082cc6be53',
      nickname: 'angry marmosett',
    },
    {
      samId: '2654885223328825f67e1',
      nickname: 'laughing elephant',
    },
    {
      samId: undefined,
      nickname: '',
    },
  ];

  test.each(expectedNicknames)('returns expected nickname for samId', ({ samId, nickname }) => {
    expect(samIdToWorkspaceNickname(samId)).toBe(nickname);
  });
});
