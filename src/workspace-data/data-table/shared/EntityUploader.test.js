import { getSuggestedTableName, validateSuggestedTableName } from './EntityUploader';

describe('getSuggestedTableName', () => {
  it('returns first column heading with no prefix or suffix', () => {
    // Arrange
    const tsv = 'foo\tbar\tbaz\n1\t2\t3\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('foo');
  });

  it('removes _id suffix', () => {
    // Arrange
    const tsv = 'sample_id\tnumber\nfoo\t1\nbar\t2\nbaz\t3\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('sample');
  });

  it('removes entity: prefix', () => {
    // Arrange
    const tsv = 'entity:sample_id\tnumber\nfoo\t1\nbar\t2\nbaz\t3\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('sample');
  });

  it('removes membership: prefix', () => {
    // Arrange
    const tsv = 'membership:sample_id\tnumber\nfoo\t1\nbar\t2\nbaz\t3\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('sample');
  });

  it('removes update: prefix', () => {
    // Arrange
    const tsv = 'update:sample_id\tnumber\nfoo\t1\nbar\t2\nbaz\t3\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('sample');
  });

  it('handles one column heading', () => {
    // Arrange
    const tsv = 'sample_id\nfoo\nbar\nbaz\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('sample');
  });

  it('does not remove _id or entity when they are internal', () => {
    // Arrange
    const tsv = 'some_entity_id_string\nfoo\nbar\nbaz\n';

    // Act
    const suggestedTableName = getSuggestedTableName(tsv);

    // Assert
    expect(suggestedTableName).toBe('some_entity_id_string');
  });

  it('returns undefined if no name can be determined', () => {
    // Arrange
    const notATsv = 'abcdefghijklmnopqrstuvwxyz';

    // Act
    const suggestedTableName = getSuggestedTableName(notATsv);

    // Assert
    expect(suggestedTableName).toBe(undefined);
  });
});

describe('validateSuggestedTableName', () => {
  const validTableNames = ['sample', 'participant', 'aliquot', 'Some-Name_With_123-789-Chars'];
  const invalidTableNames = ['unknownprefix:sample', 'disallowed/characters', '', '\t', 'space character', 'or 1=1; drop table users; --'];

  validTableNames.forEach((input) => {
    it(`passes validation for "${input}"`, () => {
      // Act
      const validated = validateSuggestedTableName(input);

      // Assert
      expect(validated).toBe(input);
    });
  });

  invalidTableNames.forEach((input) => {
    it(`fails validation for "${input}"`, () => {
      // Act
      const validated = validateSuggestedTableName(input);

      // Assert
      expect(validated).toBe(undefined);
    });
  });
});
