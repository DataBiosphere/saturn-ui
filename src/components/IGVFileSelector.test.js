import { getIgvMetricDetails, getValidIgvFiles, getValidIgvFilesFromAttributeValues, isDrsUri } from 'src/components/IGVFileSelector';
import { DrsUriResolver } from 'src/libs/ajax/drs/DrsUriResolver';

jest.mock('src/libs/ajax/drs/DrsUriResolver');

describe('getValidIgvFiles', () => {
  it('allows BAM files with indices', async () => {
    expect(
      await getValidIgvFiles([
        'gs://bucket/test1.bam',
        'gs://bucket/test2.bam',
        'gs://bucket/test2.bai',
        'gs://bucket/test3.bam',
        'gs://bucket/test3.bam.bai',
        'gs://bucket/test4.sorted.bam',
        'gs://bucket/test4.sorted.bam.bai',
      ])
    ).toEqual([
      {
        filePath: 'gs://bucket/test2.bam',
        indexFilePath: 'gs://bucket/test2.bai',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test3.bam',
        indexFilePath: 'gs://bucket/test3.bam.bai',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test4.sorted.bam',
        indexFilePath: 'gs://bucket/test4.sorted.bam.bai',
        isSignedUrl: false,
      },
    ]);
  });

  it('allows CRAM files with indices', async () => {
    expect(
      await getValidIgvFiles([
        'gs://bucket/test1.cram',
        'gs://bucket/test2.cram',
        'gs://bucket/test2.crai',
        'gs://bucket/test3.cram',
        'gs://bucket/test3.cram.crai',
      ])
    ).toEqual([
      {
        filePath: 'gs://bucket/test2.cram',
        indexFilePath: 'gs://bucket/test2.crai',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test3.cram',
        indexFilePath: 'gs://bucket/test3.cram.crai',
        isSignedUrl: false,
      },
    ]);
  });

  it('allows VCF files with indices', async () => {
    expect(
      await getValidIgvFiles([
        'gs://bucket/test1.vcf',
        'gs://bucket/test2.vcf',
        'gs://bucket/test2.idx',
        'gs://bucket/test3.vcf',
        'gs://bucket/test3.vcf.idx',
        'gs://bucket/test4.vcf',
        'gs://bucket/test4.tbi',
        'gs://bucket/test5.vcf',
        'gs://bucket/test5.vcf.tbi',
        'gs://bucket/test6.vcf.gz',
        'gs://bucket/test6.vcf.gz.tbi',
      ])
    ).toEqual([
      {
        filePath: 'gs://bucket/test2.vcf',
        indexFilePath: 'gs://bucket/test2.idx',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test3.vcf',
        indexFilePath: 'gs://bucket/test3.vcf.idx',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test4.vcf',
        indexFilePath: 'gs://bucket/test4.tbi',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test5.vcf',
        indexFilePath: 'gs://bucket/test5.vcf.tbi',
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test6.vcf.gz',
        indexFilePath: 'gs://bucket/test6.vcf.gz.tbi',
        isSignedUrl: false,
      },
    ]);
  });

  it('allows BED files', async () => {
    expect(await getValidIgvFiles(['gs://bucket/test.bed'])).toEqual([
      {
        filePath: 'gs://bucket/test.bed',
        indexFilePath: false,
        isSignedUrl: false,
      },
    ]);
  });

  it('requires GCS URLs', async () => {
    expect(await getValidIgvFiles(['gs://bucket/test.bed', 'https://example.com/test.bed', 'test.bed'])).toEqual([
      {
        filePath: 'gs://bucket/test.bed',
        indexFilePath: false,
        isSignedUrl: false,
      },
    ]);
  });

  describe('TDR URLs', () => {
    it('allows TDR URLs', async () => {
      expect(
        await getValidIgvFiles([
          'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/test.bam',
          'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/test.bam.bai',
        ])
      ).toEqual([
        {
          filePath: 'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/test.bam',
          indexFilePath: 'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/test.bam.bai',
          isSignedUrl: false,
        },
      ]);
    });

    it('allows TDR URLs with additional path segments', async () => {
      expect(
        await getValidIgvFiles([
          'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/path/to/test.bam',
          'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/path/to/test.bam.bai',
        ])
      ).toEqual([
        {
          filePath: 'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/path/to/test.bam',
          indexFilePath:
            'gs://datarepo-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/path/to/test.bam.bai',
          isSignedUrl: false,
        },
      ]);
    });

    it('allows TDR URLs from non-production environments', async () => {
      expect(
        await getValidIgvFiles([
          'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/test.bam',
          'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/test.bam.bai',
        ])
      ).toEqual([
        {
          filePath: 'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/test.bam',
          indexFilePath: 'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/test.bam.bai',
          isSignedUrl: false,
        },
      ]);
    });
  });
});

describe('getValidIgvFilesFromAttributeValues', () => {
  it('gets all valid files from lists', async () => {
    expect(
      await getValidIgvFilesFromAttributeValues([
        {
          itemsType: 'AttributeValue',
          items: ['gs://bucket/test1.bed', 'gs://bucket/test2.bed', 'gs://bucket/test3.bed'],
        },
      ])
    ).toEqual([
      {
        filePath: 'gs://bucket/test1.bed',
        indexFilePath: false,
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test2.bed',
        indexFilePath: false,
        isSignedUrl: false,
      },
      {
        filePath: 'gs://bucket/test3.bed',
        indexFilePath: false,
        isSignedUrl: false,
      },
    ]);
  });

  it('does not consider single DRS URI valid', async () => {
    // An IGV selection generally must have a file (e.g. VCF) and an index file (TBI)
    const fileDrsUri = 'drs://dg.4503:2802a94d-f540-499f-950a-db3c2a9f2dc4';
    const fileName = 'foo.vcf.gz';

    const fileNameJson = { fileName };

    // The access URL (aka signed URL) can have various parameters to track requester-pay features
    const accessUrlParams = 'requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret';
    const fileAccessUrl = `https://bucket/${fileName}?${accessUrlParams}`;

    // DRS URIs get resolved via DRS Hub.
    // API docs: https://drshub.dsde-prod.broadinstitute.org/#/drsHub/resolveDrs
    DrsUriResolver.mockImplementation(() => ({
      getDataObjectMetadata: jest.fn((_, fields) => {
        if (fields.includes('fileName')) {
          const mockJson = fileNameJson;
          return Promise.resolve(mockJson);
        }
        if (fields.includes('accessUrl')) {
          const mockAccessUrl = fileAccessUrl;
          const mockAccessUrlJson = { accessUrl: { url: mockAccessUrl } };
          return Promise.resolve(mockAccessUrlJson);
        }
      }),
    }));

    expect(
      await getValidIgvFilesFromAttributeValues([
        {
          itemsType: 'AttributeValue',
          items: ['testString', fileDrsUri, 'testString2'],
        },
      ])
    ).toEqual([]);
  });

  it('robustly detects data table values that are DRS URIs', () => {
    const drsUri = 'drs://dg.4503:2802a94d-f540-499f-950a-db3c2a9f2dc4';
    expect(isDrsUri(drsUri)).toEqual(true);

    const nonDrsUriString = 'gs://bucket/object';
    expect(isDrsUri(nonDrsUriString)).toEqual(false);

    // This assertion confirms no regression in
    // https://github.com/DataBiosphere/terra-ui/pull/5199
    const numericValue = 5;
    expect(isDrsUri(numericValue)).toEqual(false);

    const listValue = ['test'];
    expect(isDrsUri(listValue)).toEqual(false);

    const booleanValue = true;
    expect(isDrsUri(booleanValue)).toEqual(false);

    expect(isDrsUri(null)).toEqual(false);

    expect(isDrsUri(undefined)).toEqual(false);
  });

  it('calls to resolve access URLs when two DRS URIs are found', async () => {
    // An IGV selection generally must have a file (e.g. VCF) and an index file (TBI)
    const fileDrsUri = 'drs://dg.4503:2802a94d-f540-499f-950a-db3c2a9f2dc4';
    const indexFileDrsUri = 'drs://dg.4503:2802a94d-f540-499f-950a-11111111111';
    const fileName = 'foo.vcf.gz';
    const indexFileName = 'foo.vcf.gz.tbi';

    const fileNameJson = { fileName };
    const indexFileNameJson = { fileName: indexFileName };

    // The access URL (aka signed URL) can have various parameters to track requester-pay features
    const accessUrlParams = 'requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret';
    const fileAccessUrl = `https://bucket/${fileName}?${accessUrlParams}`;
    const fileIndexAccessUrl = `https://bucket/${indexFileName}?${accessUrlParams}`;

    // DRS URIs get resolved via DRS Hub.
    // API docs: https://drshub.dsde-prod.broadinstitute.org/#/drsHub/resolveDrs
    DrsUriResolver.mockImplementation(() => ({
      getDataObjectMetadata: jest.fn((value, fields) => {
        if (fields.includes('fileName')) {
          const mockJson = value === fileDrsUri ? fileNameJson : indexFileNameJson;
          return Promise.resolve(mockJson);
        }
        if (fields.includes('accessUrl')) {
          const mockAccessUrl = value === fileDrsUri ? fileAccessUrl : fileIndexAccessUrl;
          const mockAccessUrlJson = { accessUrl: { url: mockAccessUrl } };
          return Promise.resolve(mockAccessUrlJson);
        }
      }),
    }));

    expect(
      await getValidIgvFilesFromAttributeValues([
        {
          itemsType: 'AttributeValue',
          items: ['testString', fileDrsUri, indexFileDrsUri],
        },
      ])
    ).toEqual([
      {
        filePath: 'https://bucket/foo.vcf.gz?requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret',
        indexFilePath: 'https://bucket/foo.vcf.gz.tbi?requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret',
        isSignedUrl: true,
      },
    ]);
  });

  it('provides relevant component-specific logging metrics', async () => {
    const selectedFiles = [
      {
        filePath: 'https://bucket/foo.vcf.gz?requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret',
        indexFilePath: 'https://bucket/foo.vcf.gz.tbi?requestedBy=user@domain.tls&userProject=my-billing-project&signature=secret',
        isSignedUrl: true,
      },
      {
        filePath: 'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/5f5f634d-70f3-4914-9c71-9d14c7f98e60/test.bam',
        indexFilePath: 'gs://datarepo-dev-ab123456-bucket/cae37a2a-657f-4b04-9fef-59c215020078/2eeff61f-ae9e-41ae-bb40-909ff6bdfba8/test.bam.bai',
        isSignedUrl: false,
      },
    ];

    const refGenome = { genome: 'hg38' };

    const igvDetails = getIgvMetricDetails(selectedFiles, refGenome);

    expect(igvDetails).toEqual({
      igvNumTracks: 2,
      igvFileExtensions: ['vcf.gz', 'bam'],
      igvIndexExtensions: ['gz.tbi', 'bam.bai'],
      igvHasDrsUris: true,
      igvGenome: 'hg38',
    });
  });
});
