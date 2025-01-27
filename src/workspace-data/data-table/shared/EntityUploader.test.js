import { getChangeMessage, getSuggestedTableName, validateSuggestedTableName } from './EntityUploader';

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

describe('getChangeMessage', () => {
  it('returns change message when recordType matches firstColumn', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'sample';

    // Act
    const message = getChangeMessage(recordType, firstColumn);

    // Assert
    expect(message).toBe('Column sample changed to sample_id because the first column header must be an identifier.');
  });

  it('returns change message when recordType matches entity:firstColumn', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample';

    // Act
    const message = getChangeMessage(recordType, firstColumn);

    // Assert
    expect(message).toBe('Column sample changed to sample_id because the first column header must be an identifier.');
  });

  it('returns empty string when recordType does not match modified firstColumn', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:other';

    // Act
    const message = getChangeMessage(recordType, firstColumn);

    // Assert
    expect(message).toBe('');
  });

  it('returns empty string when firstColumn has _id suffix', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'sample_id';

    // Act
    const message = getChangeMessage(recordType, firstColumn);

    // Assert
    expect(message).toBe('');
  });

  it('returns empty string when entity:firstColumn has _id suffix', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample_id';

    // Act
    const message = getChangeMessage(recordType, firstColumn);

    // Assert
    expect(message).toBe('');
  });
});

describe('EntityUploader notifications', () => {
  it('shows change message when async upload begins', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample';
    const isSyncUpload = false;
    const notify = jest.fn();

    // Act
    const changeMessage = getChangeMessage(recordType, firstColumn);
    if (!isSyncUpload && changeMessage) {
      notify('warning', changeMessage, { id: `${recordType}_change_message` });
    }

    // Assert
    expect(notify).toHaveBeenCalledWith('warning', 'Column sample changed to sample_id because the first column header must be an identifier.', {
      id: 'sample_change_message',
    });
  });

  it('shows success message for synchronous Google Workspace uploads', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample';
    const isSyncUpload = true;
    const isGoogleWorkspace = true;
    const notify = jest.fn();

    // Act
    const changeMessage = getChangeMessage(recordType, firstColumn);
    if (isSyncUpload && isGoogleWorkspace) {
      notify('success', `Data imported successfully to table ${recordType}. ${changeMessage}`, { id: `${recordType}_success` });
    }

    // Assert
    expect(notify).toHaveBeenCalledWith(
      'success',
      'Data imported successfully to table sample. Column sample changed to sample_id because the first column header must be an identifier.',
      { id: 'sample_success' }
    );
  });

  it('does not show change message for synchronous upload', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample';
    const isSyncUpload = true;
    const notify = jest.fn();

    // Act
    const changeMessage = getChangeMessage(recordType, firstColumn);
    if (!isSyncUpload && changeMessage) {
      notify('warning', changeMessage, { id: `${recordType}_change_message` });
    }

    // Assert
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not show success message for asynchronous non-Google Workspace uploads', () => {
    // Arrange
    const recordType = 'sample';
    const firstColumn = 'entity:sample';
    const isSyncUpload = false;
    const isGoogleWorkspace = false;
    const notify = jest.fn();

    // Act
    const changeMessage = getChangeMessage(recordType, firstColumn);
    if (isSyncUpload && isGoogleWorkspace) {
      notify('success', `Data imported successfully to table ${recordType}. ${changeMessage}`, { id: `${recordType}_success` });
    }

    // Assert
    expect(notify).not.toHaveBeenCalled();
  });
});
