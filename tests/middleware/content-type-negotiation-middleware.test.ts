import type { HttpError } from '@chubbyts/chubbyts-http-error/http-error';
import type { Negotiator } from '@chubbyts/chubbyts-negotiation/negotiation';
import { describe, expect, test } from 'vitest';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/object-mock';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/function-mock';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import { createContentTypeNegotiationMiddleware } from '../../src/middleware/content-type-negotiation-middleware.js';
import { createResponse, createServerRequest, serverRequestHelpers } from '../http.js';

describe('content-type-negotiation-middleware', () => {
  describe('createContentTypeNegotiationMiddleware', () => {
    test('successfully', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      const response = createResponse();

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          callback: async (givenRequest: ServerRequest) => {
            expect(givenRequest.attributes).toMatchInlineSnapshot(`
              {
                "contentType": "application/json",
              }
            `);

            return response;
          },
        },
      ]);

      const [contentTypeNegotiator, contentTypeNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'negotiate',
          parameters: ['application/json'],
          return: { value: 'application/json', attributes: { q: '1.0' } },
        },
      ]);

      const contentTypeNegotiationMiddleware = createContentTypeNegotiationMiddleware({
        serverRequestHelpers,
        contentTypeNegotiator,
      });

      expect(await contentTypeNegotiationMiddleware(serverRequest, handler)).toBe(response);

      expect(handlerMocks).toHaveLength(0);
      expect(contentTypeNegotiatorMocks).toHaveLength(0);
    });

    test('no negotiated value', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'POST',
        headers: { 'content-type': 'application/xml, application/x-yaml' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [contentTypeNegotiator, contentTypeNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'negotiate',
          parameters: ['application/xml, application/x-yaml'],
          return: undefined,
        },
        {
          name: 'supportedValues',
          value: ['application/json', 'application/x-something'],
        },
      ]);

      const contentTypeNegotiationMiddleware = createContentTypeNegotiationMiddleware({
        serverRequestHelpers,
        contentTypeNegotiator,
      });

      try {
        await contentTypeNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "UnsupportedMediaType",
            "detail": "Allowed content-types: "application/json", "application/x-something"",
            "status": 415,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Unsupported Media Type",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.16",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(contentTypeNegotiatorMocks).toHaveLength(0);
    });

    test('empty header', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'POST',
        headers: { 'content-type': '' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [contentTypeNegotiator, contentTypeNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'negotiate',
          parameters: [''],
          return: undefined,
        },
        {
          name: 'supportedValues',
          value: ['application/json', 'application/x-something'],
        },
      ]);

      const contentTypeNegotiationMiddleware = createContentTypeNegotiationMiddleware({
        serverRequestHelpers,
        contentTypeNegotiator,
      });

      try {
        await contentTypeNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "UnsupportedMediaType",
            "detail": "Allowed content-types: "application/json", "application/x-something"",
            "status": 415,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Unsupported Media Type",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.16",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(contentTypeNegotiatorMocks).toHaveLength(0);
    });

    test('no header', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'POST',
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [contentTypeNegotiator, contentTypeNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'supportedValues',
          value: ['application/json', 'application/x-something'],
        },
      ]);

      const contentTypeNegotiationMiddleware = createContentTypeNegotiationMiddleware({
        serverRequestHelpers,
        contentTypeNegotiator,
      });

      try {
        await contentTypeNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "UnsupportedMediaType",
            "detail": "Missing content-type: "application/json", "application/x-something"",
            "status": 415,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Unsupported Media Type",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.16",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(contentTypeNegotiatorMocks).toHaveLength(0);
    });
  });
});
