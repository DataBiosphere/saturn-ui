import { asMockedFn } from '@terra-ui-packages/test-utils';
import { WorkspaceData } from 'src/libs/ajax/WorkspaceDataService';

import { fetchWDS } from './ajax-common';

type AjaxCommonExports = typeof import('src/libs/ajax/ajax-common');

jest.mock('src/libs/ajax/ajax-common', (): AjaxCommonExports => {
  return {
    ...jest.requireActual<AjaxCommonExports>('src/libs/ajax/ajax-common'),
    fetchWDS: jest.fn(),
  };
});

describe('WorkspaceData', () => {
  describe('getCapabilities', () => {
    type SetupOptions = {
      stubbedCapabilitiesResponse?: Promise<Response>;
      wdsProxyUrl?: string;
    };
    type SetupResult = {
      wdsProxyUrl: string;
    };
    function setup({
      wdsProxyUrl = 'https://wds.test.proxy.url',
      stubbedCapabilitiesResponse = Promise.resolve(new Response('{"capabilities":true}')),
    }: SetupOptions): SetupResult {
      asMockedFn(fetchWDS).mockImplementation((wdsProxyUrlRoot: string) => {
        if (wdsProxyUrlRoot !== wdsProxyUrl) {
          throw new Error(`Unexpected wdsProxyUrlRoot: ${wdsProxyUrlRoot}`);
        }
        return (path: RequestInfo | URL, _options: RequestInit | undefined) => {
          if (path === 'capabilities/v1') {
            return stubbedCapabilitiesResponse;
          }
          throw new Error('Unexpected path');
        };
      });

      return {
        wdsProxyUrl,
      };
    }

    it('returns true for capabilities when present and true', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.resolve(new Response('{"capabilities": true }')),
      });

      // Act
      const capabilities = await WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      expect(fetchWDS).toHaveBeenCalledWith(wdsProxyUrl);
      expect(capabilities.capabilities).toEqual(true);
    });

    it('returns false for capabilities when present and false', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.resolve(new Response('{"capabilities": false }')),
      });

      // Act
      const capabilities = await WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      expect(fetchWDS).toHaveBeenCalledWith(wdsProxyUrl);
      expect(capabilities.capabilities).toEqual(false);
    });

    it('returns false for capabilities when present and non-boolean', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.resolve(new Response('{"capabilities": "true" }')),
      });

      // Act
      const capabilities = await WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      expect(fetchWDS).toHaveBeenCalledWith(wdsProxyUrl);
      expect(capabilities.capabilities).toEqual(false);
    });

    it('returns true for an unknown capability that is present and true', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.resolve(new Response('{"unknownCapability": true }')),
      });

      // Act
      const capabilities = await WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      expect(fetchWDS).toHaveBeenCalledWith(wdsProxyUrl);
      expect(capabilities.unknownCapability).toEqual(true);
    });

    it('returns false for capabilities when response is a 404', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.reject(new Response('{ "message": "Not found"}', { status: 404 })),
      });

      // Act
      const capabilities = await WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      expect(fetchWDS).toHaveBeenCalledWith(wdsProxyUrl);
      expect(capabilities.capabilities).toEqual(false);
    });

    it('throws on an unexpected error', async () => {
      // Arrange
      const { wdsProxyUrl } = setup({
        stubbedCapabilitiesResponse: Promise.reject(
          new Response('{ "message": "Internal server error"}', { status: 500 })
        ),
      });

      // Act
      const act = async () => WorkspaceData().getCapabilities(wdsProxyUrl);

      // Assert
      await expect(act()).rejects.toEqual(
        expect.objectContaining({
          status: 500,
        })
      );
    });
  });
});
