import { describe, expect, test } from 'vitest';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/function-mock';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/object-mock';
import type { Container } from '@chubbyts/chubbyts-dic-types/container';
import type { ConfigFactory } from '@chubbyts/chubbyts-dic-config/dic-config';
import { createContainerByConfigFactory } from '@chubbyts/chubbyts-dic-config/dic-config';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { createEncoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { createJsonTypeEncoder } from '@chubbyts/chubbyts-decode-encode/encoder/json-type-encoder';
import { decoderServiceFactory, encoderServiceFactory } from '@chubbyts/chubbyts-decode-encode/service-factory';
import type { HttpError } from '@chubbyts/chubbyts-http-error/http-error';
import { createImateapot, createNotFound } from '@chubbyts/chubbyts-http-error/http-error';
import type { Logger } from '@chubbyts/chubbyts-log-types/log';
import type { Negotiator } from '@chubbyts/chubbyts-negotiation/negotiation';
import { createAcceptNegotiator } from '@chubbyts/chubbyts-negotiation/accept-negotiator';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';
import type { MapToHttpError } from '../src/middleware/error-middleware.js';
import {
  acceptLanguageNegotiationMiddlewareServiceFactory,
  acceptNegotiationMiddlewareServiceFactory,
  contentTypeNegotiationMiddlewareServiceFactory,
  errorMiddlewareLoggableAttributeNamesServiceFactory,
  errorMiddlewareServiceFactory,
  mapToHttpErrorServiceFactory,
} from '../src/service-factory.js';
import {
  createServerRequest,
  readBody,
  responseFactory,
  responseHelpers,
  serverRequestHelpers,
  bodyFactory,
} from './http.js';

// the create functions return opaque closures, so the wiring gets proven by exercising the created middlewares against
// mocked collaborators (negotiator, encoder, logger, handler)

const allContentTypes = [
  'application/json',
  'application/jsonx+xml',
  'application/jsonl',
  'application/x-jsonl',
  'text/jsonl',
  'application/ndjson',
  'application/x-ndjson',
  'application/x-www-form-urlencoded',
  'application/x-yaml',
  'application/yaml',
];

const createNegotiatorMock = (supportedValues: Array<string>) => {
  return useObjectMock<Negotiator>([{ name: 'supportedValues', value: supportedValues }]);
};

const expectNotAcceptable = async (promise: Promise<unknown>, detail: string, supportedValues: Array<string>) => {
  await expect(promise).rejects.toMatchObject({ status: 406, detail, supportedValues });
};

describe('acceptLanguageNegotiationMiddlewareServiceFactory', () => {
  test('without registered acceptLanguageNegotiator', async () => {
    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptLanguageNegotiator'], return: false },
      { name: 'has', parameters: ['acceptLanguageNegotiatorSupportedValues'], return: false },
    ]);

    const middleware = acceptLanguageNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    // the shipped negotiator factory gets used: the default supported values are empty
    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept-language: ""',
      [],
    );

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with registered acceptLanguageNegotiator', async () => {
    const [negotiator, negotiatorMocks] = createNegotiatorMock(['en', 'de']);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptLanguageNegotiator'], return: true },
      { name: 'get', parameters: ['acceptLanguageNegotiator'], return: negotiator },
    ]);

    const middleware = acceptLanguageNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    // the registered negotiator wins over the shipped factory
    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept-language: "en", "de"',
      ['en', 'de'],
    );

    expect(negotiatorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with name, with registered named acceptLanguageNegotiator', async () => {
    const [negotiator, negotiatorMocks] = createNegotiatorMock(['fr']);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptLanguageNegotiatorapi'], return: true },
      { name: 'get', parameters: ['acceptLanguageNegotiatorapi'], return: negotiator },
    ]);

    const middleware = acceptLanguageNegotiationMiddlewareServiceFactory('api')(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept-language: "fr"',
      ['fr'],
    );

    expect(negotiatorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });
});

describe('acceptNegotiationMiddlewareServiceFactory', () => {
  test('without registered acceptNegotiator', async () => {
    const encoder = createEncoder([createJsonTypeEncoder()]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptNegotiator'], return: false },
      { name: 'has', parameters: ['acceptNegotiatorSupportedValues'], return: false },
      { name: 'get', parameters: ['encoder'], return: encoder },
    ]);

    const middleware = acceptNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    // the shipped negotiator factory gets used: the content types of the encoder are the supported values
    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept: "application/json"',
      ['application/json'],
    );

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with registered acceptNegotiator', async () => {
    const [negotiator, negotiatorMocks] = createNegotiatorMock(['application/json']);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptNegotiator'], return: true },
      { name: 'get', parameters: ['acceptNegotiator'], return: negotiator },
    ]);

    const middleware = acceptNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept: "application/json"',
      ['application/json'],
    );

    expect(negotiatorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with name, without registered named acceptNegotiator', async () => {
    const encoder = createEncoder([createJsonTypeEncoder()]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['acceptNegotiatorapi'], return: false },
      { name: 'has', parameters: ['acceptNegotiatorSupportedValuesapi'], return: false },
      { name: 'get', parameters: ['encoderapi'], return: encoder },
    ]);

    const middleware = acceptNegotiationMiddlewareServiceFactory('api')(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    // the name gets passed down to the shipped negotiator factory, so the named encoder gets used
    await expectNotAcceptable(
      middleware(createServerRequest('https://example.com/resource'), handler),
      'Missing accept: "application/json"',
      ['application/json'],
    );

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });
});

describe('contentTypeNegotiationMiddlewareServiceFactory', () => {
  test('without registered contentTypeNegotiator', async () => {
    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['contentTypeNegotiator'], return: false },
      { name: 'has', parameters: ['contentTypeNegotiatorSupportedValues'], return: false },
      { name: 'get', parameters: ['decoder'], return: { contentTypes: ['application/json'] } },
    ]);

    const middleware = contentTypeNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    // the shipped negotiator factory gets used: the content types of the decoder are the supported values
    await expect(
      middleware(createServerRequest('https://example.com/resource', { method: 'POST' }), handler),
    ).rejects.toMatchObject({
      status: 415,
      detail: 'Missing content-type: "application/json"',
      supportedValues: ['application/json'],
    });

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with registered contentTypeNegotiator', async () => {
    const [negotiator, negotiatorMocks] = createNegotiatorMock(['application/x-yaml']);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['contentTypeNegotiator'], return: true },
      { name: 'get', parameters: ['contentTypeNegotiator'], return: negotiator },
    ]);

    const middleware = contentTypeNegotiationMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    await expect(
      middleware(createServerRequest('https://example.com/resource', { method: 'POST' }), handler),
    ).rejects.toMatchObject({
      status: 415,
      detail: 'Missing content-type: "application/x-yaml"',
      supportedValues: ['application/x-yaml'],
    });

    expect(negotiatorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with name, with registered named contentTypeNegotiator', async () => {
    const [negotiator, negotiatorMocks] = createNegotiatorMock(['application/x-yaml']);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['serverRequestHelpers'], return: serverRequestHelpers },
      { name: 'has', parameters: ['contentTypeNegotiatorapi'], return: true },
      { name: 'get', parameters: ['contentTypeNegotiatorapi'], return: negotiator },
    ]);

    const middleware = contentTypeNegotiationMiddlewareServiceFactory('api')(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([]);

    await expect(
      middleware(createServerRequest('https://example.com/resource', { method: 'POST' }), handler),
    ).rejects.toMatchObject({ status: 415, supportedValues: ['application/x-yaml'] });

    expect(negotiatorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });
});

describe('mapToHttpErrorServiceFactory', () => {
  test('create', () => {
    const error = new Error('example');

    const [container, containerMocks] = useObjectMock<Container>([]);

    const mapToHttpError = mapToHttpErrorServiceFactory()(container);

    // the default rethrows, so unknown errors end up as internal server errors
    expect(() => mapToHttpError(error)).toThrow(error);

    expect(containerMocks).toHaveLength(0);
  });
});

describe('errorMiddlewareLoggableAttributeNamesServiceFactory', () => {
  test('create', () => {
    const [container, containerMocks] = useObjectMock<Container>([]);

    expect(errorMiddlewareLoggableAttributeNamesServiceFactory()(container)).toEqual([]);

    expect(containerMocks).toHaveLength(0);
  });
});

describe('errorMiddlewareServiceFactory', () => {
  test('with defaults, without registered services', async () => {
    const config = {};

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: config },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'has', parameters: ['bodyFactory'], return: true },
      { name: 'get', parameters: ['bodyFactory'], return: bodyFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['encoder'], return: false },
      { name: 'has', parameters: ['typeEncoders'], return: false },
      { name: 'get', parameters: ['config'], return: config },
      { name: 'has', parameters: ['mapToHttpError'], return: false },
      { name: 'has', parameters: ['logger'], return: false },
      { name: 'has', parameters: ['errorMiddlewareLoggableAttributeNames'], return: false },
    ]);

    const middleware = errorMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([
      {
        callback: async (): Promise<Response> => {
          throw new Error('example');
        },
      },
    ]);

    const response = await middleware(
      createServerRequest('https://example.com/resource', { attributes: { accept: 'application/json' } }),
      handler,
    );

    // the shipped encoder factory and the default mapToHttpError get used: a non http error becomes a 500,
    // without debug the details are hidden
    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toEqual(['application/json']);
    expect(JSON.parse(await readBody(response))).toEqual({
      type: 'https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1',
      status: 500,
      title: 'Internal Server Error',
    });

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with defaults, with deprecated streamFactory service', async () => {
    const config = {};

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: config },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'has', parameters: ['bodyFactory'], return: false },
      { name: 'get', parameters: ['streamFactory'], return: bodyFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['encoder'], return: false },
      { name: 'has', parameters: ['typeEncoders'], return: false },
      { name: 'get', parameters: ['config'], return: config },
      { name: 'has', parameters: ['mapToHttpError'], return: false },
      { name: 'has', parameters: ['logger'], return: false },
      { name: 'has', parameters: ['errorMiddlewareLoggableAttributeNames'], return: false },
    ]);

    const middleware = errorMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([
      {
        callback: async (): Promise<Response> => {
          throw new Error('example');
        },
      },
    ]);

    const response = await middleware(
      createServerRequest('https://example.com/resource', { attributes: { accept: 'application/json' } }),
      handler,
    );

    // the shipped encoder factory and the default mapToHttpError get used: a non http error becomes a 500,
    // without debug the details are hidden
    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toEqual(['application/json']);
    expect(JSON.parse(await readBody(response))).toEqual({
      type: 'https://datatracker.ietf.org/doc/html/rfc2616#section-10.5.1',
      status: 500,
      title: 'Internal Server Error',
    });

    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with debug, with registered services', async () => {
    const serverRequest = createServerRequest('https://example.com/resource?key=value', {
      attributes: { accept: 'application/json', requestId: 'request-id' },
    });

    const error = new Error('example');
    const httpError = createImateapot({ detail: 'mapped' });

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      {
        name: 'encode',
        callback: (data: unknown, contentType: string): string => {
          expect(contentType).toBe('application/json');

          return JSON.stringify(data);
        },
      },
    ]);

    const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([
      { parameters: [error], return: httpError },
    ]);

    const [logger, loggerMocks] = useObjectMock<Logger>([
      {
        name: 'info',
        callback: (message: string, context: Record<string, unknown>): void => {
          expect(message).toBe('Http Error');
          expect(context).toMatchObject({
            method: 'GET',
            pathnameSearch: '/resource?key=value',
            requestId: 'request-id',
            status: 418,
            detail: 'mapped',
          });
        },
      },
    ]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: { debug: true } },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'has', parameters: ['bodyFactory'], return: true },
      { name: 'get', parameters: ['bodyFactory'], return: bodyFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['encoder'], return: true },
      { name: 'get', parameters: ['encoder'], return: encoder },
      { name: 'has', parameters: ['mapToHttpError'], return: true },
      { name: 'get', parameters: ['mapToHttpError'], return: mapToHttpError },
      { name: 'has', parameters: ['logger'], return: true },
      { name: 'get', parameters: ['logger'], return: logger },
      { name: 'has', parameters: ['errorMiddlewareLoggableAttributeNames'], return: true },
      { name: 'get', parameters: ['errorMiddlewareLoggableAttributeNames'], return: ['requestId'] },
    ]);

    const middleware = errorMiddlewareServiceFactory()(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([{ parameters: [serverRequest], error }]);

    const response = await middleware(serverRequest, handler);

    // the registered encoder, mapToHttpError, logger and loggable attribute names win over the shipped factories
    expect(response.status).toBe(418);
    expect(JSON.parse(await readBody(response))).toMatchObject({ status: 418, detail: 'mapped' });

    expect(encoderMocks).toHaveLength(0);
    expect(mapToHttpErrorMocks).toHaveLength(0);
    expect(loggerMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });

  test('with name, with registered named services', async () => {
    const serverRequest = createServerRequest('https://example.com/resource', {
      attributes: { accept: 'application/json' },
    });

    const error = new Error('example');

    const [encoder, encoderMocks] = useObjectMock<Encoder>([
      {
        name: 'encode',
        callback: (data: unknown): string => {
          return JSON.stringify(data);
        },
      },
    ]);

    const [mapToHttpError, mapToHttpErrorMocks] = useFunctionMock<MapToHttpError>([
      { parameters: [error], error: new Error('mapping failed') },
    ]);

    const [container, containerMocks] = useObjectMock<Container>([
      { name: 'get', parameters: ['config'], return: { debug: true } },
      { name: 'get', parameters: ['responseFactory'], return: responseFactory },
      { name: 'has', parameters: ['bodyFactory'], return: true },
      { name: 'get', parameters: ['bodyFactory'], return: bodyFactory },
      { name: 'get', parameters: ['responseHelpers'], return: responseHelpers },
      { name: 'has', parameters: ['encoderapi'], return: true },
      { name: 'get', parameters: ['encoderapi'], return: encoder },
      { name: 'has', parameters: ['mapToHttpErrorapi'], return: true },
      { name: 'get', parameters: ['mapToHttpErrorapi'], return: mapToHttpError },
      { name: 'has', parameters: ['logger'], return: false },
      { name: 'has', parameters: ['errorMiddlewareLoggableAttributeNamesapi'], return: false },
    ]);

    const middleware = errorMiddlewareServiceFactory('api')(container);

    const [handler, handlerMocks] = useFunctionMock<Handler>([{ parameters: [serverRequest], error }]);

    const response = await middleware(serverRequest, handler);

    // with debug the details are exposed
    expect(response.status).toBe(500);
    expect(JSON.parse(await readBody(response))).toMatchObject({
      status: 500,
      error: { name: 'Error', message: 'mapping failed' },
    });

    expect(encoderMocks).toHaveLength(0);
    expect(mapToHttpErrorMocks).toHaveLength(0);
    expect(handlerMocks).toHaveLength(0);
    expect(containerMocks).toHaveLength(0);
  });
});

describe('with container by config', () => {
  test('the services are wired together', async () => {
    const container = createContainerByConfigFactory({
      debug: false,
      dependencies: {
        factories: new Map<string, ConfigFactory>([
          ['serverRequestHelpers', () => serverRequestHelpers],
          ['responseFactory', () => responseFactory],
          ['responseHelpers', () => responseHelpers],
          ['bodyFactory', () => bodyFactory],
          ['decoder', decoderServiceFactory()],
          ['encoder', encoderServiceFactory()],
          ['acceptLanguageNegotiatorSupportedValues', (): Array<string> => ['en', 'de']],
          ['acceptLanguageNegotiationMiddleware', acceptLanguageNegotiationMiddlewareServiceFactory()],
          ['acceptNegotiationMiddleware', acceptNegotiationMiddlewareServiceFactory()],
          ['contentTypeNegotiationMiddleware', contentTypeNegotiationMiddlewareServiceFactory()],
          ['errorMiddleware', errorMiddlewareServiceFactory()],
        ]),
      },
    })();

    const acceptLanguageNegotiationMiddleware = container.get<Middleware>('acceptLanguageNegotiationMiddleware');
    const acceptNegotiationMiddleware = container.get<Middleware>('acceptNegotiationMiddleware');
    const contentTypeNegotiationMiddleware = container.get<Middleware>('contentTypeNegotiationMiddleware');
    const errorMiddleware = container.get<Middleware>('errorMiddleware');

    const serverRequest = createServerRequest('https://example.com/resource', { method: 'POST' });

    const [handler, handlerMocks] = useFunctionMock<Handler>([
      {
        callback: async (request: ServerRequest): Promise<Response> => {
          // each negotiation middleware stores its negotiated value as attribute
          expect(request.attributes).toEqual({
            acceptLanguage: 'en',
            accept: 'application/json',
            contentType: 'application/x-yaml',
          });

          throw createNotFound({ detail: 'missing' });
        },
      },
    ]);

    // the configured supported values get used by the accept language negotiator, the encoder / decoder content types
    // by the accept / content type negotiator
    await expectNotAcceptable(
      acceptLanguageNegotiationMiddleware(serverRequest, handler),
      'Missing accept-language: "en", "de"',
      ['en', 'de'],
    );
    await expectNotAcceptable(
      acceptNegotiationMiddleware(serverRequest, handler),
      `Missing accept: "${allContentTypes.join('", "')}"`,
      allContentTypes,
    );
    await expect(contentTypeNegotiationMiddleware(serverRequest, handler)).rejects.toMatchObject({
      status: 415,
      supportedValues: allContentTypes,
    });

    // the error middleware encodes the http error thrown by the handler behind the negotiation middlewares
    const response = await errorMiddleware(
      createServerRequest('https://example.com/resource', {
        method: 'POST',
        headers: { accept: 'application/json', 'accept-language': 'en', 'content-type': 'application/x-yaml' },
        attributes: { accept: 'application/json' },
      }),
      (request1) =>
        acceptLanguageNegotiationMiddleware(request1, (request2) =>
          acceptNegotiationMiddleware(request2, (request3) => contentTypeNegotiationMiddleware(request3, handler)),
        ),
    );

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toEqual(['application/json']);
    expect(JSON.parse(await readBody(response))).toMatchObject({ status: 404, detail: 'missing' });

    expect(handlerMocks).toHaveLength(0);
  });

  test('the named services are wired together', async () => {
    const container = createContainerByConfigFactory({
      dependencies: {
        factories: new Map<string, ConfigFactory>([
          ['serverRequestHelpers', () => serverRequestHelpers],
          ['responseFactory', () => responseFactory],
          ['responseHelpers', () => responseHelpers],
          ['bodyFactory', () => bodyFactory],
          ['encoderapi', (): Encoder => createEncoder([createJsonTypeEncoder()])],
          ['acceptNegotiatorapi', (): Negotiator => createAcceptNegotiator(['application/x-yaml'])],
          ['acceptNegotiationMiddlewareapi', acceptNegotiationMiddlewareServiceFactory('api')],
          ['mapToHttpErrorapi', (): MapToHttpError => (): HttpError => createImateapot({})],
          ['errorMiddlewareapi', errorMiddlewareServiceFactory('api')],
        ]),
      },
    })();

    const acceptNegotiationMiddleware = container.get<Middleware>('acceptNegotiationMiddlewareapi');
    const errorMiddleware = container.get<Middleware>('errorMiddlewareapi');

    const serverRequest = createServerRequest('https://example.com/resource', {
      attributes: { accept: 'application/json' },
    });

    const [handler, handlerMocks] = useFunctionMock<Handler>([
      { parameters: [serverRequest], error: new Error('example') },
    ]);

    // the named negotiator wins over the named encoder content types
    await expectNotAcceptable(
      acceptNegotiationMiddleware(serverRequest, handler),
      'Missing accept: "application/x-yaml"',
      ['application/x-yaml'],
    );

    // the named encoder and mapToHttpError get used
    const response = await errorMiddleware(serverRequest, handler);

    expect(response.status).toBe(418);
    expect(response.headers['content-type']).toEqual(['application/json']);

    expect(handlerMocks).toHaveLength(0);
  });
});
