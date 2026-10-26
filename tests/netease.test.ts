import assert from 'node:assert/strict';
import test from 'node:test';

async function loadApiClient() {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3000';
  return import('../src/api/apiRequest');
}

test('cookies stay in POST bodies and requests bypass URL-based response caches', async (context) => {
  const client = await loadApiClient();
  const requests: { url: string; options?: RequestInit }[] = [];
  client.configureSessionAccessors({ getCookie: () => 'test-session', onSessionExpired: () => {} });
  context.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, options?: RequestInit) => {
      requests.push({ url: String(input), options });
      return new Response(JSON.stringify({ code: 200 }), { status: 200 });
    },
  );

  await client.requestApi('/like', { id: 123, like: true }, { authenticated: true });
  await client.requestApi('/like', { id: 123, like: false }, { authenticated: true });

  assert.notEqual(requests[0]?.url, requests[1]?.url);
  for (const request of requests) {
    assert.equal(request.options?.method, 'POST');
    assert.equal(request.options?.credentials, 'omit');
    assert.equal(request.url.includes('test-session'), false);
    assert.equal(JSON.parse(String(request.options?.body)).cookie, 'test-session');
  }
});

test('protected HTTP failures expire only the credential used by that request', async (context) => {
  const client = await loadApiClient();
  const expiredCookies: string[] = [];
  client.configureSessionAccessors({
    getCookie: () => 'test-session',
    onSessionExpired: (cookie) => expiredCookies.push(cookie),
  });
  context.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ code: 200 }), { status: 401 }),
  );

  await assert.rejects(
    client.requestApi('/like', { id: 123 }, { authenticated: true }),
    (error: unknown) => error instanceof client.ApiError && error.code === 401,
  );
  assert.deepEqual(expiredCookies, ['test-session']);
});

test('QR waiting statuses are not errors and explicit anonymous calls omit session cookies', async (context) => {
  const client = await loadApiClient();
  let capturedBody = '';
  client.configureSessionAccessors({
    getCookie: () => 'test-session',
    onSessionExpired: () => assert.fail('QR polling must not expire the account'),
  });
  context.mock.method(
    globalThis,
    'fetch',
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      capturedBody = String(options?.body);
      return new Response(JSON.stringify({ code: 801 }), { status: 200 });
    },
  );

  const response = await client.requestApi(
    '/login/qr/check',
    { key: 'test-key' },
    { cookie: null, acceptedCodes: [800, 801, 802, 803] },
  );
  assert.equal(response.code, 801);
  assert.equal('cookie' in JSON.parse(capturedBody), false);
});

test('song adapters support both detail and search response shapes without inventing users', async () => {
  await loadApiClient();
  const adapters = await import('../src/api/responseAdapters');
  const common = { id: 123, name: 'Test track', fee: 1 };
  const detail = adapters.adaptSong({
    ...common,
    ar: [{ name: 'Test artist' }],
    al: { name: 'Test album', picUrl: 'http://example.com/art.jpg' },
    dt: 120000,
  });
  const search = adapters.adaptSong({
    ...common,
    artists: [{ name: 'Test artist' }],
    album: { name: 'Test album', picUrl: 'http://example.com/art.jpg' },
    duration: 120000,
  });
  assert.deepEqual(detail, search);
  assert.equal(detail.duration, 120);
  assert.equal(detail.artwork, 'https://example.com/art.jpg');
  assert.equal(adapters.adaptProfile({}), null);
});
