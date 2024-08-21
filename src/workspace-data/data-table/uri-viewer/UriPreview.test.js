import { canRender, isBinary, isFilePreviewable, isImage, isText } from './UriPreview';

describe('File Utilities', () => {
  describe('isImage', () => {
    it('should return true for image content types', () => {
      expect(isImage({ contentType: 'image/jpeg', name: 'photo.jpg' })).toBe(true);
      expect(isImage({ contentType: 'image/png', name: 'image.png' })).toBe(true);
    });

    it('should return true for image file extensions', () => {
      expect(isImage({ contentType: 'application/octet-stream', name: 'icon.svg' })).toBe(true);
      expect(isImage({ contentType: 'application/octet-stream', name: 'picture.bmp' })).toBe(true);
    });

    it('should return false for non-image types or names', () => {
      expect(isImage({ contentType: 'text/plain', name: 'document.txt' })).toBe(false);
      expect(isImage({ contentType: 'application/json', name: 'data.json' })).toBe(false);
    });
  });

  describe('isText', () => {
    it('should return true for text content types', () => {
      expect(isText({ contentType: 'text/plain', name: 'readme.txt' })).toBe(true);
      expect(isText({ contentType: 'application/json', name: 'config.json' })).toBe(true);
    });

    it('should return true for text file extensions', () => {
      expect(isText({ contentType: 'application/octet-stream', name: 'file.csv' })).toBe(true);
      expect(isText({ contentType: 'application/octet-stream', name: 'log.log' })).toBe(true);
    });

    it('should return false for non-text types or names', () => {
      expect(isText({ contentType: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
      expect(isText({ contentType: 'application/pdf', name: 'document.pdf' })).toBe(false);
    });
  });

  describe('isBinary', () => {
    it('should return true for binary content types', () => {
      expect(isBinary({ contentType: 'application/pdf', name: 'file.pdf' })).toBe(true);
      expect(isBinary({ contentType: 'application/vnd.ms-excel', name: 'sheet.xls' })).toBe(true);
    });

    it('should return true for binary file extensions', () => {
      expect(isBinary({ contentType: 'application/octet-stream', name: 'archive.pac' })).toBe(true);
      expect(isBinary({ contentType: 'application/octet-stream', name: 'file.bam' })).toBe(true);
    });

    it('should return false for non-binary types or names', () => {
      expect(isBinary({ contentType: 'text/plain', name: 'readme.txt' })).toBe(false);
      expect(isBinary({ contentType: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
    });
  });

  describe('canRender', () => {
    it('should return true for renderable content types', () => {
      expect(canRender({ contentType: 'text/html', name: 'page.html' })).toBe(true);
      expect(canRender({ contentType: 'application/pdf', name: 'document.pdf' })).toBe(true);
    });

    it('should return true for renderable file extensions', () => {
      expect(canRender({ contentType: 'application/octet-stream', name: 'manual.pdf' })).toBe(true);
      expect(canRender({ contentType: 'application/octet-stream', name: 'website.html' })).toBe(true);
    });

    it('should return false for non-renderable types or names', () => {
      expect(canRender({ contentType: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
      expect(canRender({ contentType: 'application/json', name: 'data.json' })).toBe(false);
    });
  });

  describe('isFilePreviewable', () => {
    it('should return true for previewable binary files', () => {
      expect(isFilePreviewable({ size: 500000000, contentType: 'application/pdf', name: 'file.pdf' })).toBe(true);
    });

    it('should return true for previewable text files', () => {
      expect(isFilePreviewable({ size: 1000, contentType: 'text/plain', name: 'readme.txt' })).toBe(true);
    });

    it('should return true for previewable image files under size limit', () => {
      expect(isFilePreviewable({ size: 100000000, contentType: 'image/jpeg', name: 'photo.jpg' })).toBe(true);
    });

    it('should return false for non-previewable files over size limit', () => {
      expect(isFilePreviewable({ size: 2000000000, contentType: 'image/png', name: 'large-image.png' })).toBe(false);
    });

    it('should return false for non-previewable files of other types', () => {
      expect(isFilePreviewable({ size: 500000000, contentType: 'video/mp4', name: 'video.mp4' })).toBe(false);
    });
  });
});
