import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { EncodeError } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { describe, expect, test } from 'vitest';
import { createBodyFactory } from '@chubbyts/chubbyts-http/message-factory';
import { ZodError } from 'zod';
import { createNotFound } from '@chubbyts/chubbyts-http-error/http-error';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/object-mock';
import { createResponseWithData, resolveBodyFactory, valueToData } from '../src/response.js';
import { createServerRequest, readBody, responseFactory, responseHelpers, bodyFactory } from './http.js';

describe('response', () => {
  describe('valueToData', () => {
    test('with supported data', () => {
      expect(
        valueToData({
          key1: 'value',
          key2: 2,
          key3: true,
          key4: null,
          key5: undefined,
          key6: new Date('2022-06-09T19:43:12.326Z'),
          key7: ['value', 2, true, null, undefined, new Date('2022-06-09T19:43:12.326Z')],
          key8: {
            key1: 'value',
            key2: 2,
            key3: true,
            key4: null,
            key5: undefined,
            key6: new Date('2022-06-09T19:43:12.326Z'),
            key7: ['value', 2, true, null, undefined, new Date('2022-06-09T19:43:12.326Z')],
          },
        }),
      ).toMatchInlineSnapshot(`
      {
        "key1": "value",
        "key2": 2,
        "key3": true,
        "key4": null,
        "key6": "2022-06-09T19:43:12.326Z",
        "key7": [
          "value",
          2,
          true,
          null,
          "2022-06-09T19:43:12.326Z",
        ],
        "key8": {
          "key1": "value",
          "key2": 2,
          "key3": true,
          "key4": null,
          "key6": "2022-06-09T19:43:12.326Z",
          "key7": [
            "value",
            2,
            true,
            null,
            "2022-06-09T19:43:12.326Z",
          ],
        },
      }
    `);
    });

    test('with http error', () => {
      expect(
        valueToData({
          error: createNotFound({
            detail: 'missing',
            instance: '/api/pets/1',
            headers: { 'retry-after': '10' },
            createdAt: new Date('2022-06-09T19:43:12.326Z'),
            reasons: ['a', undefined, 'b'],
          }),
          errors: [createNotFound({ detail: 'missing' })],
        }),
      ).toMatchInlineSnapshot(`
        {
          "error": {
            "_httpError": "NotFound",
            "createdAt": "2022-06-09T19:43:12.326Z",
            "detail": "missing",
            "headers": {
              "retry-after": "10",
            },
            "instance": "/api/pets/1",
            "reasons": [
              "a",
              "b",
            ],
            "status": 404,
            "title": "Not Found",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
          },
          "errors": [
            {
              "_httpError": "NotFound",
              "detail": "missing",
              "status": 404,
              "title": "Not Found",
              "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
            },
          ],
        }
      `);
    });

    test('with unsupported object', () => {
      try {
        valueToData({
          key: {
            errors: [
              new ZodError([
                {
                  code: 'custom',
                  params: { key: 'value' },
                  input: 'data',
                  message: 'Custom',
                  path: ['path', 'to', 'field'],
                },
              ]),
            ],
          },
        });
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toMatchInlineSnapshot('[Error: Unsupported value of type ZodError]');
      }
    });

    test('with unsupported function', () => {
      try {
        valueToData({ key: { functions: [() => undefined] } });
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toMatchInlineSnapshot('[Error: Unsupported value of type function]');
      }
    });
  });

  describe('resolveBodyFactory', () => {
    test('with bodyFactory', () => {
      expect(resolveBodyFactory({ bodyFactory })).toBe(bodyFactory);
    });

    test('with deprecated streamFactory', () => {
      expect(resolveBodyFactory({ streamFactory: bodyFactory })).toBe(bodyFactory);
    });

    test('with bodyFactory and deprecated streamFactory, bodyFactory wins', () => {
      const streamFactory = createBodyFactory();

      expect(streamFactory).not.toBe(bodyFactory);
      expect(resolveBodyFactory({ bodyFactory, streamFactory })).toBe(bodyFactory);
    });
  });

  describe('createResponseWithData', () => {
    test('without given accept attribute', () => {
      const data = {};

      const serverRequest = createServerRequest('https://example.com/');

      const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

      try {
        createResponseWithData({
          responseFactory,
          bodyFactory,
          responseHelpers,
          serverRequest,
          encoder,
          data,
          status: 200,
          reasonPhrase: 'OK',
        });
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(
          '[Error: Use createAcceptNegotiationMiddleware to assign request.attributes.accept.]',
        );
      }

      expect(encoderMocks).toHaveLength(0);
    });

    test('with data', async () => {
      const data = {
        key1: 'value',
        key2: 2,
        key3: true,
        key4: null,
        key5: ['value', 2, true, null],
        key6: {
          key1: 'value',
          key2: 2,
          key3: true,
          key4: null,
          key5: ['value', 2, true, null],
        },
      };

      const serverRequest = createServerRequest('https://example.com/', {
        attributes: { accept: 'application/json' },
      });

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [data, 'application/json', { serverRequest }],
          return: JSON.stringify(data),
        },
      ]);

      const response = createResponseWithData({
        responseFactory,
        bodyFactory,
        responseHelpers,
        serverRequest,
        encoder,
        data,
        status: 200,
        reasonPhrase: 'OK',
      });

      expect(response.status).toBe(200);
      expect(response.reasonPhrase).toBe('OK');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);
      expect(JSON.parse(await readBody(response))).toEqual(data);

      expect(encoderMocks).toHaveLength(0);
    });

    test('with data and headers', async () => {
      const data = {
        key1: 'value',
      };

      const serverRequest = createServerRequest('https://example.com/', {
        attributes: { accept: 'application/json' },
      });

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [data, 'application/json', { serverRequest }],
          return: JSON.stringify(data),
        },
      ]);

      const response = createResponseWithData({
        responseFactory,
        bodyFactory,
        responseHelpers,
        serverRequest,
        encoder,
        data,
        status: 405,
        reasonPhrase: 'Method Not Allowed',
        headers: {
          allow: 'POST',
          'content-type': 'text/html',
        },
      });

      expect(response.status).toBe(405);
      expect(response.reasonPhrase).toBe('Method Not Allowed');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "allow": [
            "POST",
          ],
          "content-type": [
            "application/json",
          ],
        }
      `);
      expect(JSON.parse(await readBody(response))).toEqual(data);

      expect(encoderMocks).toHaveLength(0);
    });

    test('with data and headers, with deprecated streamFactory', async () => {
      const data = {
        key1: 'value',
      };

      const serverRequest = createServerRequest('https://example.com/', {
        attributes: { accept: 'application/json' },
      });

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [data, 'application/json', { serverRequest }],
          return: JSON.stringify(data),
        },
      ]);

      const response = createResponseWithData({
        responseFactory,
        streamFactory: bodyFactory,
        responseHelpers,
        serverRequest,
        encoder,
        data,
        status: 405,
        reasonPhrase: 'Method Not Allowed',
        headers: {
          allow: 'POST',
          'content-type': 'text/html',
        },
      });

      expect(response.status).toBe(405);
      expect(response.reasonPhrase).toBe('Method Not Allowed');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "allow": [
            "POST",
          ],
          "content-type": [
            "application/json",
          ],
        }
      `);
      expect(JSON.parse(await readBody(response))).toEqual(data);

      expect(encoderMocks).toHaveLength(0);
    });

    test('with data, but with decode error', () => {
      const error = new EncodeError('something went wrong');

      const data = {
        key1: 'value',
      };

      const serverRequest = createServerRequest('https://example.com/', {
        attributes: { accept: 'application/json' },
      });

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        { name: 'encode', parameters: [data, 'application/json', { serverRequest }], error },
      ]);

      try {
        createResponseWithData({
          responseFactory,
          bodyFactory,
          responseHelpers,
          serverRequest,
          encoder,
          data,
          status: 200,
          reasonPhrase: 'OK',
        });
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(encoderMocks).toHaveLength(0);
    });
  });
});
