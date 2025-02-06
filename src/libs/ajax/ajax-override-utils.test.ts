import { makeError, makeSuccess, mapJsonBody, mountAjaxOverrideUtils } from './ajax-override-utils';

type FetchFn = typeof fetch;

describe('mapJsonBody', () => {
  it('updates response body', async () => {
    // Arrange
    const originalFetch: FetchFn = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ foo: 1, bar: 2, baz: 3 })));

    // Act
    // Wrap fetch in an override that modifies the response body by incrementing all values in the object.
    const withModifiedResponse = mapJsonBody((obj) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Number(v) + 1]))
    );
    const fetchWithOverride = withModifiedResponse(originalFetch);

    // Make a request using the wrapped fetch.
    const response = await fetchWithOverride('/api', { headers: { Authorization: 'Bearer token' } });
    const responseBody = await response.json();

    // Assert
    expect(originalFetch).toHaveBeenCalledWith('/api', { headers: { Authorization: 'Bearer token' } });
    expect(response).toBeInstanceOf(Response);
    expect(responseBody).toEqual({ foo: 2, bar: 3, baz: 4 });
  });
});

describe('makeError', () => {
  it('overrides response with error response', async () => {
    // Arrange
    const originalFetch: FetchFn = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    // Act
    // Wrap fetch in an override that always returns an error response.
    const withErrorResponse = makeError({ status: 500 });
    const fetchWithOverride = withErrorResponse(originalFetch);

    // Make a request using the wrapped fetch.
    const response = await fetchWithOverride('/api', { headers: { Authorization: 'Bearer token' } });
    const responseBody = await response.text();

    // Assert
    expect(originalFetch).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(500);
    expect(responseBody).toBe('Instrumented error');
  });

  it('can override responses randomly', async () => {
    // Arrange
    const random = jest.spyOn(Math, 'random');

    const originalFetch: FetchFn = jest.fn().mockResolvedValue(new Response('Success', { status: 200 }));

    // Act
    // Wrap fetch in an override that returns an error response for 50% of requests.
    const withIntermittentErrorResponse = makeError({ status: 500, frequency: 0.5 });
    const fetchWithOverride = withIntermittentErrorResponse(originalFetch);

    // Make requests using the wrapped fetch.
    random.mockReturnValue(0.25);
    const firstResponse = await fetchWithOverride('/api', { headers: { Authorization: 'Bearer token' } });
    const firstResponseBody = await firstResponse.text();

    random.mockReturnValue(0.75);
    const secondResponse = await fetchWithOverride('/api', { headers: { Authorization: 'Bearer token' } });
    const secondResponseBody = await secondResponse.text();

    // Assert
    expect(originalFetch).toHaveBeenCalledTimes(1);

    expect(firstResponse.status).toBe(500);
    expect(firstResponseBody).toBe('Instrumented error');

    expect(secondResponse.status).toBe(200);
    expect(secondResponseBody).toBe('Success');
  });
});

describe('makeSuccess', () => {
  it('overrides response with success response', async () => {
    // Arrange
    const originalFetch: FetchFn = jest.fn().mockResolvedValue(new Response('Error', { status: 500 }));

    // Act
    // Wrap fetch in an override that always returns a successful response.
    const withSuccessResponse = makeSuccess({ message: 'Success' });
    const fetchWithOverride = withSuccessResponse(originalFetch);

    // Make a request using the wrapped fetch.
    const response = await fetchWithOverride('/api', { headers: { Authorization: 'Bearer token' } });
    const responseBody = await response.json();

    // Assert
    expect(originalFetch).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(responseBody).toEqual({ message: 'Success' });
  });
});

describe('mountAjaxOverrideUtils', () => {
  it('mounts uitls for use by end2end tests', () => {
    //  Act
    mountAjaxOverrideUtils();

    // Assert
    expect(window.ajaxOverrideUtils).toBeDefined();
    expect(window.ajaxOverrideUtils.makeError).toBeDefined();
    expect(window.ajaxOverrideUtils.makeSuccess).toBeDefined();
    expect(window.ajaxOverrideUtils.mapJsonBody).toBeDefined();
    expect(window.ajaxOverrideUtils.overrideAppsWithLocalWDS).toBeDefined();
  });
});
