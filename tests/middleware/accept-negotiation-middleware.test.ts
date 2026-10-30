import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Negotiator } from '@chubbyts/chubbyts-negotiation/dist/negotiation';
import { describe, expect, test } from 'vitest';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/dist/function-mock';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import { createAcceptNegotiationMiddleware } from '../../src/middleware/accept-negotiation-middleware.js';
import { createResponse, createServerRequest, serverRequestHelpers } from '../http.js';

describe('accept-negotiation-middleware', () => {
  describe('createAcceptNegotiationMiddleware', () => {
    test('successfully', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        headers: { accept: 'application/json' },
      });

      const response = createResponse();

      const [handler, handlerMocks] = useFunctionMock<Handler>([
        {
          callback: async (givenRequest: ServerRequest) => {
            expect(givenRequest.attributes).toMatchInlineSnapshot(`
              {
                "accept": "application/json",
              }
            `);

            return response;
          },
        },
      ]);

      const [acceptNegotiator, acceptNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'negotiate',
          parameters: ['application/json'],
          return: { value: 'application/json', attributes: { q: '1.0' } },
        },
      ]);

      const acceptNegotiationMiddleware = createAcceptNegotiationMiddleware({ serverRequestHelpers, acceptNegotiator });

      expect(await acceptNegotiationMiddleware(serverRequest, handler)).toBe(response);

      expect(handlerMocks).toHaveLength(0);
      expect(acceptNegotiatorMocks).toHaveLength(0);
    });

    test('no negotiated value', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        headers: { accept: 'application/xml, application/x-yaml' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [acceptNegotiator, acceptNegotiatorMocks] = useObjectMock<Negotiator>([
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

      const acceptNegotiationMiddleware = createAcceptNegotiationMiddleware({ serverRequestHelpers, acceptNegotiator });

      try {
        await acceptNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "NotAcceptable",
            "detail": "Allowed accepts: "application/json", "application/x-something"",
            "status": 406,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Not Acceptable",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.7",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(acceptNegotiatorMocks).toHaveLength(0);
    });

    test('empty header', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
        headers: { accept: '' },
      });

      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [acceptNegotiator, acceptNegotiatorMocks] = useObjectMock<Negotiator>([
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

      const acceptNegotiationMiddleware = createAcceptNegotiationMiddleware({ serverRequestHelpers, acceptNegotiator });

      try {
        await acceptNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "NotAcceptable",
            "detail": "Allowed accepts: "application/json", "application/x-something"",
            "status": 406,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Not Acceptable",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.7",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(acceptNegotiatorMocks).toHaveLength(0);
    });

    test('missing header', async () => {
      const serverRequest = createServerRequest('https://example.com/path/to/route', {
        method: 'GET',
      });
      const [handler, handlerMocks] = useFunctionMock<Handler>([]);

      const [acceptNegotiator, acceptNegotiatorMocks] = useObjectMock<Negotiator>([
        {
          name: 'supportedValues',
          value: ['application/json', 'application/x-something'],
        },
      ]);

      const acceptNegotiationMiddleware = createAcceptNegotiationMiddleware({ serverRequestHelpers, acceptNegotiator });

      try {
        await acceptNegotiationMiddleware(serverRequest, handler);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "NotAcceptable",
            "detail": "Missing accept: "application/json", "application/x-something"",
            "status": 406,
            "supportedValues": [
              "application/json",
              "application/x-something",
            ],
            "title": "Not Acceptable",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.7",
          }
        `);
      }

      expect(handlerMocks).toHaveLength(0);
      expect(acceptNegotiatorMocks).toHaveLength(0);
    });
  });
});
