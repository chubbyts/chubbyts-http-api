import type { Data } from '@chubbyts/chubbyts-decode-encode/dist';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/dist/decoder';
import { DecodeError } from '@chubbyts/chubbyts-decode-encode/dist/decoder';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/dist/encoder';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import {
  createServerRequest,
  readBody,
  responseFactory,
  responseHelpers,
  serverRequestHelpers,
  streamFactory,
} from '../http.js';
import { createTypedHandler } from '../../src/handler/typed.js';
import { valueToData } from '../../src/response.js';

describe('createTypedHandler', () => {
  test('handles the request and response body path', async () => {
    const requestBody = { name: 'Ada' };
    const requestBodyString = JSON.stringify(requestBody);
    const responseBody = { id: '4b328098-8ab4-4c5f-ab58-185179a9c1d7', name: 'Ada' };
    const responseData = valueToData(responseBody);
    const responseBodyString = JSON.stringify(responseData);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: [requestBodyString, 'application/json'], return: requestBody },
    ]);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      { name: 'encode', parameters: [responseData, 'application/json'], return: responseBodyString },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ contentType: z.string(), accept: z.string(), subject: z.string() }),
        headers: z.object({ 'x-request-id': z.string() }),
        query: z.object({ page: z.coerce.number() }),
        body: z.object({ name: z.string() }),
      },
      response: {
        headers: z.object({ 'x-response-id': z.string() }),
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async (request) => {
        expect(request.attributes).toEqual({
          contentType: 'application/json',
          accept: 'application/json',
          subject: 'user',
        });
        expect(request.headers).toEqual({ 'x-request-id': 'request-1' });
        expect(request.query).toEqual({ page: 2 });
        expect(request.body).toEqual(requestBody);

        return {
          status: 201,
          reasonPhrase: 'Created',
          headers: { 'x-response-id': 'response-1' },
          body: responseBody,
        };
      },
      decoder,
      encoder,
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users?page=2', {
        method: 'POST',
        attributes: { contentType: 'application/json', accept: 'application/json', subject: 'user' },
        headers: { 'x-request-id': 'request-1' },
        body: requestBodyString,
      }),
    );

    expect(response.status).toBe(201);
    expect(response.reasonPhrase).toBe('Created');
    expect(response.headers).toEqual({
      'content-type': ['application/json'],
      'x-response-id': ['response-1'],
    });
    expect(JSON.parse(await readBody(response))).toEqual(responseData);

    expect(decoderMocks).toHaveLength(0);
    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the request body only path', async () => {
    const requestBody = { name: 'Grace' };
    const requestBodyString = JSON.stringify(requestBody);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: [requestBodyString, 'application/json'], return: requestBody },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {},
      handler: async (request) => {
        expect(request.attributes).toEqual({ contentType: 'application/json' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});
        expect(request.body).toEqual(requestBody);

        return { status: 204, reasonPhrase: 'No Content' };
      },
      decoder,
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        body: requestBodyString,
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');

    expect(decoderMocks).toHaveLength(0);
  });

  test('handles the request body only path with response headers', async () => {
    const requestBody = { name: 'Katherine' };
    const requestBodyString = JSON.stringify(requestBody);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: [requestBodyString, 'application/json'], return: requestBody },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {
        headers: z.object({ 'x-response-id': z.string() }),
      },
      handler: async (request) => {
        expect(request.attributes).toEqual({ contentType: 'application/json' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});
        expect(request.body).toEqual(requestBody);

        return { status: 204, reasonPhrase: 'No Content', headers: { 'x-response-id': 'response-2' } };
      },
      decoder,
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        body: requestBodyString,
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({ 'x-response-id': ['response-2'] });
    expect(await readBody(response)).toBe('');

    expect(decoderMocks).toHaveLength(0);
  });

  test('handles the response body only path', async () => {
    const responseBody = { id: '392de555-ae4e-4188-8562-2a4273702380', name: 'Linus' };
    const responseData: Data = valueToData(responseBody);
    const responseBodyString = JSON.stringify(responseData);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      { name: 'encode', parameters: [responseData, 'application/vnd.user+json'], return: responseBodyString },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ accept: z.string(), subject: z.string() }),
      },
      response: {
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async (request) => {
        expect(request.attributes).toEqual({ accept: 'application/vnd.user+json', subject: 'user' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});

        return { status: 200, reasonPhrase: 'OK', body: responseBody };
      },
      encoder,
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users/392de555-ae4e-4188-8562-2a4273702380', {
        method: 'GET',
        attributes: { accept: 'application/vnd.user+json', subject: 'user' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({ 'content-type': ['application/vnd.user+json'] });
    expect(JSON.parse(await readBody(response))).toEqual(responseData);

    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the response body only path with response headers', async () => {
    const responseBody = { id: 'a1bbba0f-f226-45b9-9a05-86a80dc6e54b', name: 'Margaret' };
    const responseData: Data = valueToData(responseBody);
    const responseBodyString = JSON.stringify(responseData);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      { name: 'encode', parameters: [responseData, 'application/vnd.user+json'], return: responseBodyString },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ accept: z.string(), subject: z.string() }),
      },
      response: {
        headers: z.object({ 'x-response-id': z.string() }),
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async (request) => {
        expect(request.attributes).toEqual({ accept: 'application/vnd.user+json', subject: 'user' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});

        return {
          status: 200,
          reasonPhrase: 'OK',
          headers: { 'x-response-id': 'response-3' },
          body: responseBody,
        };
      },
      encoder,
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users/a1bbba0f-f226-45b9-9a05-86a80dc6e54b', {
        method: 'GET',
        attributes: { accept: 'application/vnd.user+json', subject: 'user' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({
      'content-type': ['application/vnd.user+json'],
      'x-response-id': ['response-3'],
    });
    expect(JSON.parse(await readBody(response))).toEqual(responseData);

    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the path without request or response body', async () => {
    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ subject: z.string() }),
      },
      response: {},
      handler: async (request) => {
        expect(request.attributes).toEqual({ subject: 'user' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});

        return { status: 204, reasonPhrase: 'No Content' };
      },
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users/392de555-ae4e-4188-8562-2a4273702380', {
        method: 'DELETE',
        attributes: { subject: 'user' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');
  });

  test('handles the path without request or response body with response headers', async () => {
    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ subject: z.string() }),
      },
      response: {
        headers: z.object({ 'x-response-id': z.string() }),
      },
      handler: async (request) => {
        expect(request.attributes).toEqual({ subject: 'user' });
        expect(request.headers).toEqual({});
        expect(request.query).toEqual({});

        return { status: 204, reasonPhrase: 'No Content', headers: { 'x-response-id': 'response-4' } };
      },
    });

    const response = await typedHandler(
      createServerRequest('https://example.com/users/392de555-ae4e-4188-8562-2a4273702380', {
        method: 'DELETE',
        attributes: { subject: 'user' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({ 'x-response-id': ['response-4'] });
    expect(await readBody(response)).toBe('');
  });

  test('handles the response body only path with an explicitly undefined decoder', async () => {
    const responseBody = { id: '0644ce3c-2ff8-44f7-b34e-393a0dee14ee', name: 'Alan' };
    const responseData: Data = valueToData(responseBody);
    const responseBodyString = JSON.stringify(responseData);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      { name: 'encode', parameters: [responseData, 'application/json'], return: responseBodyString },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ accept: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async () => ({ status: 200, reasonPhrase: 'OK', body: responseBody }),
      decoder: undefined,
      encoder,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users/0644ce3c-2ff8-44f7-b34e-393a0dee14ee', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({ 'content-type': ['application/json'] });
    expect(JSON.parse(await readBody(response))).toEqual(responseData);

    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the response body only path with an explicitly undefined request body schema', async () => {
    const responseBody = { id: '552cc853-f5e1-4ef9-b567-1e1ab1846b1c', name: 'Barbara' };
    const responseData: Data = valueToData(responseBody);
    const responseBodyString = JSON.stringify(responseData);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([]);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      { name: 'encode', parameters: [responseData, 'application/json'], return: responseBodyString },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ accept: z.string() }),
        body: undefined,
      },
      response: {
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async () => ({ status: 200, reasonPhrase: 'OK', body: responseBody }),
      decoder,
      encoder,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users/552cc853-f5e1-4ef9-b567-1e1ab1846b1c', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({ 'content-type': ['application/json'] });
    expect(JSON.parse(await readBody(response))).toEqual(responseData);

    expect(decoderMocks).toHaveLength(0);
    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the request body only path with an explicitly undefined encoder', async () => {
    const requestBody = { name: 'Dennis' };
    const requestBodyString = JSON.stringify(requestBody);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: [requestBodyString, 'application/json'], return: requestBody },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async () => ({ status: 204, reasonPhrase: 'No Content' }),
      decoder,
      encoder: undefined,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        body: requestBodyString,
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');

    expect(decoderMocks).toHaveLength(0);
  });

  test('handles the request body only path with an explicitly undefined response body schema', async () => {
    const requestBody = { name: 'Edsger' };
    const requestBodyString = JSON.stringify(requestBody);

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: [requestBodyString, 'application/json'], return: requestBody },
    ]);

    const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {
        body: undefined,
      },
      handler: async () => ({ status: 204, reasonPhrase: 'No Content' }),
      decoder,
      encoder,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        body: requestBodyString,
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');

    expect(decoderMocks).toHaveLength(0);
    expect(encoderMocks).toHaveLength(0);
  });

  test('handles the path without request or response body with request body schema but without decoder', async () => {
    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ subject: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {},
      handler: async () => ({ status: 204, reasonPhrase: 'No Content' }),
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users/392de555-ae4e-4188-8562-2a4273702380', {
        method: 'DELETE',
        attributes: { subject: 'user' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.reasonPhrase).toBe('No Content');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');
  });

  test('handles the path without request or response body with an explicitly undefined encoder', async () => {
    const responseBody = { id: '9b810bfe-3242-42e6-811a-06bbcbcbb51b', name: 'Frances' };

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ subject: z.string() }),
      },
      response: {
        body: z.object({ id: z.string(), name: z.string() }),
      },
      handler: async () => ({ status: 200, reasonPhrase: 'OK', body: responseBody }),
      encoder: undefined,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users/9b810bfe-3242-42e6-811a-06bbcbcbb51b', {
        method: 'GET',
        attributes: { subject: 'user' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');
  });

  test('handles the path without request or response body with an explicitly undefined response body schema', async () => {
    const responseBody = { id: '11a4dad8-a10d-4fed-b25f-8e0c2c04a1a2', name: 'Grace' };

    const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      streamFactory,
      request: {
        attributes: z.object({ subject: z.string() }),
      },
      response: {
        body: undefined,
      },
      handler: async () => ({ status: 200, reasonPhrase: 'OK', body: responseBody }),
      encoder,
    } as never);

    const response = await typedHandler(
      createServerRequest('https://example.com/users/11a4dad8-a10d-4fed-b25f-8e0c2c04a1a2', {
        method: 'GET',
        attributes: { subject: 'user' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.reasonPhrase).toBe('OK');
    expect(response.headers).toEqual({});
    expect(await readBody(response)).toBe('');

    expect(encoderMocks).toHaveLength(0);
  });

  test('rejects invalid request headers', async () => {
    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ subject: z.string() }),
        headers: z.object({ 'x-request-id': z.string() }),
      },
      response: {},
      handler: async () => {
        throw new Error('unexpected handler call');
      },
    });

    try {
      await typedHandler(
        createServerRequest('https://example.com/users/392de555-ae4e-4188-8562-2a4273702380', {
          method: 'DELETE',
          attributes: { subject: 'user' },
        }),
      );

      throw new Error('expect fail');
    } catch (e) {
      expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
        {
          "_httpError": "BadRequest",
          "context": "headers",
          "invalidParameters": [
            {
              "context": {
                "code": "invalid_type",
                "expected": "string",
              },
              "name": "x-request-id",
              "reason": "Invalid input: expected string, received undefined",
            },
          ],
          "status": 400,
          "title": "Bad Request",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.1",
        }
      `);
    }
  });

  test('rejects a request body that can not be decoded', async () => {
    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: ['', 'application/json'], error: new DecodeError('Unexpected end of JSON input') },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {},
      handler: async () => {
        throw new Error('unexpected handler call');
      },
      decoder,
    });

    try {
      await typedHandler(
        createServerRequest('https://example.com/users', {
          method: 'POST',
          attributes: { contentType: 'application/json' },
          body: '',
        }),
      );

      throw new Error('expect fail');
    } catch (e) {
      expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
        {
          "_httpError": "BadRequest",
          "context": "body",
          "detail": "Unexpected end of JSON input",
          "status": 400,
          "title": "Bad Request",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.1",
        }
      `);
    }

    expect(decoderMocks).toHaveLength(0);
  });

  test('rethrows other decoder errors', async () => {
    const error = new Error('Unsupported contentType "application/xml"');

    const [decoder, decoderMocks] = useObjectMock<Decoder>([
      { name: 'decode', parameters: ['<name>Ada</name>', 'application/xml'], error },
    ]);

    const typedHandler = createTypedHandler({
      serverRequestHelpers,
      responseFactory,
      responseHelpers,
      request: {
        attributes: z.object({ contentType: z.string() }),
        body: z.object({ name: z.string() }),
      },
      response: {},
      handler: async () => {
        throw new Error('unexpected handler call');
      },
      decoder,
    });

    await expect(
      typedHandler(
        createServerRequest('https://example.com/users', {
          method: 'POST',
          attributes: { contentType: 'application/xml' },
          body: '<name>Ada</name>',
        }),
      ),
    ).rejects.toBe(error);

    expect(decoderMocks).toHaveLength(0);
  });
});
