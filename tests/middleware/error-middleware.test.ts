import type { Data } from '@chubbyts/chubbyts-decode-encode/data';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import {
  createImateapot,
  createNotAcceptable,
  createInternalServerError,
  createMethodNotAllowed,
  createServiceUnavailable,
} from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Logger } from '@chubbyts/chubbyts-log-types/dist/log';
import { describe, expect, test } from 'vitest';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/dist/function-mock';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { MapToHttpError } from '../../src/middleware/error-middleware.js';
import { createErrorMiddleware } from '../../src/middleware/error-middleware.js';
import {
  createResponse,
  createServerRequest,
  readBody,
  responseFactory,
  responseHelpers,
  streamFactory,
} from '../http.js';

describe('error-middleware', () => {
  describe('createErrorMiddleware', () => {
    test('no error, minimal', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
      });

      const response = createResponse();

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          return: Promise.resolve(response),
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      expect(await errorMiddleware(serverRequest, handler)).toBe(response);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('no error, maximal', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
      });

      const response = createResponse();

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          return: Promise.resolve(response),
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

      const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([]);

      const logger: Logger = {} as Logger;

      const errorMiddleware = createErrorMiddleware({
        responseFactory,
        streamFactory,
        responseHelpers,
        encoder,
        mapToHttpError,
        debug: true,
        logger,
      });

      expect(await errorMiddleware(serverRequest, handler)).toBe(response);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(mapToHttpErrorMocks).toHaveLength(0);
    });

    test('error, minimal', async () => {
      const error = new Error('something went wrong');

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [
            {
              status: 500,
              title: 'Internal Server Error',
              type: 'https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1',
            },
            'application/json',
            { serverRequest },
          ],
          return: JSON.stringify({
            status: 500,
            title: 'Internal Server Error',
            type: 'https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1',
          }),
        },
      ]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(500);
      expect(response.reasonPhrase).toBe('Internal Server Error');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toMatchInlineSnapshot(`
        {
          "status": 500,
          "title": "Internal Server Error",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1",
        }
      `);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('http client error, minimal', async () => {
      const httpError = createMethodNotAllowed({
        title: 'Method Not Allowed',
        detail: 'Some detail about the error',
      });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error: httpError,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [{ ...httpError } as Data, 'application/json', { serverRequest }],
          return: JSON.stringify({ ...httpError }),
        },
      ]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(405);
      expect(response.reasonPhrase).toBe('Method Not Allowed');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({ ...httpError });

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('http client error with headers, minimal', async () => {
      const httpError = createMethodNotAllowed({
        title: 'Method Not Allowed',
        detail: 'Some detail about the error',
        headers: { allow: 'POST, PUT' },
      });

      const { headers: _, ...body } = httpError;

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error: httpError,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [body as Data, 'application/json', { serverRequest }],
          return: JSON.stringify(body),
        },
      ]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(405);
      expect(response.reasonPhrase).toBe('Method Not Allowed');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "allow": [
            "POST, PUT",
          ],
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual(body);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('http server error, minimal', async () => {
      const httpError = createInternalServerError({
        detail: 'Some detail about the error',
      });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error: httpError,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [
            { type: httpError.type, status: httpError.status, title: httpError.title },
            'application/json',
            { serverRequest },
          ],
          return: JSON.stringify({ type: httpError.type, status: httpError.status, title: httpError.title }),
        },
      ]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(500);
      expect(response.reasonPhrase).toBe('Internal Server Error');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({
        type: httpError.type,
        status: httpError.status,
        title: httpError.title,
      });

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('error to http client error, maximal', async () => {
      const error = new Error('something went wrong');
      const httpError = createImateapot({ detail: 'teapod....' });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [{ ...httpError } as Data, 'application/json', { serverRequest }],
          return: JSON.stringify({ ...httpError }),
        },
      ]);

      const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([
        { parameters: [error], return: httpError },
      ]);

      const [logger, loggerMocks] = useObjectMock<Logger>([
        {
          name: 'info',
          callback: (givenMessage: string, givenContext: Record<string, unknown>): void => {
            expect(givenMessage).toMatchInlineSnapshot('"Http Error"');
            expect({ ...givenContext }).toMatchInlineSnapshot(`
              {
                "_httpError": "Imateapot",
                "detail": "teapod....",
                "method": "GET",
                "pathnameSearch": "/path/to/route",
                "status": 418,
                "title": "I'm a teapot",
                "type": "https://datatracker.ietf.org/doc/html/rfc2324#section-2.3.2",
              }
            `);
          },
        },
      ]);

      const errorMiddleware = createErrorMiddleware({
        responseFactory,
        streamFactory,
        responseHelpers,
        encoder,
        mapToHttpError,
        debug: true,
        logger,
      });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(418);
      expect(response.reasonPhrase).toBe("I'm a Teapot");
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({ ...httpError });

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(mapToHttpErrorMocks).toHaveLength(0);
      expect(loggerMocks).toHaveLength(0);
    });

    test('error to http server error, maximal', async () => {
      const error = new Error('something went wrong');

      const httpError = createServiceUnavailable({
        detail: 'Something went wrong',
      });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        attributes: { accept: 'application/json' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          parameters: [{ ...httpError } as Data, 'application/json', { serverRequest }],
          return: JSON.stringify({ ...httpError }),
        },
      ]);

      const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([
        {
          parameters: [error],
          return: httpError,
        },
      ]);

      const [logger, loggerMocks] = useObjectMock<Logger>([
        {
          name: 'error',
          callback: (givenMessage: string, givenContext: Record<string, unknown>): void => {
            expect(givenMessage).toMatchInlineSnapshot('"Http Error"');
            expect({ ...(givenContext as HttpError) }).toMatchInlineSnapshot(`
              {
                "_httpError": "ServiceUnavailable",
                "detail": "Something went wrong",
                "method": "GET",
                "pathnameSearch": "/path/to/route",
                "status": 503,
                "title": "Service Unavailable",
                "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.4",
              }
            `);
          },
        },
      ]);

      const errorMiddleware = createErrorMiddleware({
        responseFactory,
        streamFactory,
        responseHelpers,
        encoder,
        mapToHttpError,
        debug: true,
        logger,
      });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(503);
      expect(response.reasonPhrase).toBe('Service Unavailable');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({ ...httpError });

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(mapToHttpErrorMocks).toHaveLength(0);
      expect(loggerMocks).toHaveLength(0);
    });

    test('error throw another error, maximal', async () => {
      const error = new Error('something went wrong');

      const serverRequest = createServerRequest('https://example.com/path/to/route?key1%5Bkey11%5D=value11', {
        method: 'GET',
        attributes: {
          accept: 'application/json',
          clientIp: '172.16.0.2',
          requestId: '1149831cb8ea26571b8318dc74fa0659',
        },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          callback: (givenData, givenContentType, givenContext) => {
            // oxlint-disable-next-line typescript/ban-ts-comment
            // @ts-ignore
            // oxlint-disable-next-line functional/immutable-data
            delete givenData.error.stack;

            expect(givenData).toMatchInlineSnapshot(`
              {
                "_httpError": "InternalServerError",
                "error": {
                  "message": "Another error",
                  "name": "Error",
                },
                "status": 500,
                "title": "Internal Server Error",
                "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1",
              }
            `);
            expect(givenContentType).toBe('application/json');
            expect(givenContext).toEqual({ serverRequest });

            return JSON.stringify(givenData);
          },
        },
      ]);

      const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([
        {
          parameters: [error],
          error: new Error('Another error'),
        },
      ]);

      const [logger, loggerMocks] = useObjectMock<Logger>([
        {
          name: 'error',
          callback: (givenMessage: string, givenContext: Record<string, unknown>): void => {
            expect(givenMessage).toMatchInlineSnapshot('"Http Error"');

            // oxlint-disable-next-line typescript/ban-ts-comment
            // @ts-ignore
            // oxlint-disable-next-line functional/immutable-data
            delete givenContext.error.stack;

            expect({ ...(givenContext as HttpError) }).toMatchInlineSnapshot(`
              {
                "_httpError": "InternalServerError",
                "clientIp": "172.16.0.2",
                "error": {
                  "message": "Another error",
                  "name": "Error",
                },
                "method": "GET",
                "pathnameSearch": "/path/to/route?key1%5Bkey11%5D=value11",
                "requestId": "1149831cb8ea26571b8318dc74fa0659",
                "status": 500,
                "title": "Internal Server Error",
                "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1",
                "unknownAttribute": undefined,
              }
            `);
          },
        },
      ]);

      const errorMiddleware = createErrorMiddleware({
        responseFactory,
        streamFactory,
        responseHelpers,
        encoder,
        mapToHttpError,
        debug: true,
        logger,
        loggableAttributeNames: ['clientIp', 'requestId', 'unknownAttribute'],
      });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(500);
      expect(response.reasonPhrase).toBe('Internal Server Error');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toMatchInlineSnapshot(`
        {
          "_httpError": "InternalServerError",
          "error": {
            "message": "Another error",
            "name": "Error",
          },
          "status": 500,
          "title": "Internal Server Error",
          "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1",
        }
      `);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(mapToHttpErrorMocks).toHaveLength(0);
      expect(loggerMocks).toHaveLength(0);
    });

    test('http client error without negotiated accept, falls back to the first encoder content type', async () => {
      const httpError = createNotAcceptable({ detail: 'Allowed accepts: "application/json"' });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error: httpError,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        { name: 'contentTypes', value: ['application/json', 'application/x-yaml'] },
        {
          name: 'encode',
          parameters: [{ ...httpError } as Data, 'application/json', { serverRequest }],
          return: JSON.stringify({ ...httpError }),
        },
      ]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      const response = await errorMiddleware(serverRequest, handler);

      expect(response.status).toBe(406);
      expect(response.reasonPhrase).toBe('Not Acceptable');
      expect(response.headers).toEqual({ 'content-type': ['application/json'] });

      expect(JSON.parse(await readBody(response))).toEqual({ ...httpError });

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('http client error without negotiated accept and without encoder content types, rethrows', async () => {
      const httpError = createNotAcceptable({ detail: 'Allowed accepts: ""' });

      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          parameters: [serverRequest],
          error: httpError,
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([{ name: 'contentTypes', value: [] }]);

      const errorMiddleware = createErrorMiddleware({ responseFactory, streamFactory, responseHelpers, encoder });

      await expect(errorMiddleware(serverRequest, handler)).rejects.toBe(httpError);

      expect(handlerMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });
  });
});
