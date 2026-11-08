import type { Container } from '@chubbyts/chubbyts-dic-types/container';
import { createAbstractFactory } from '@chubbyts/chubbyts-dic-config-factory/dic-config-factory';
import { encoderServiceFactory } from '@chubbyts/chubbyts-decode-encode/service-factory';
import type { Logger } from '@chubbyts/chubbyts-log-types/log';
import {
  acceptLanguageNegotiatorServiceFactory,
  acceptNegotiatorServiceFactory,
  contentTypeNegotiatorServiceFactory,
} from '@chubbyts/chubbyts-negotiation/service-factory';
import type { ResponseFactory, BodyFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';
import { createAcceptLanguageNegotiationMiddleware } from './middleware/accept-language-negotiation-middleware.js';
import { createAcceptNegotiationMiddleware } from './middleware/accept-negotiation-middleware.js';
import { createContentTypeNegotiationMiddleware } from './middleware/content-type-negotiation-middleware.js';
import type { MapToHttpError } from './middleware/error-middleware.js';
import { createErrorMiddleware } from './middleware/error-middleware.js';

type Config = {
  debug?: boolean;
};

// the http-types implementation (e.g. @chubbyts/chubbyts-http) gets shared by all services of the container
const serverRequestHelpersId = 'serverRequestHelpers';
const responseFactoryId = 'responseFactory';
const responseHelpersId = 'responseHelpers';
const bodyFactoryId = 'bodyFactory';
// the deprecated id of the body factory service, used as fallback if there is no `bodyFactory` service
const streamFactoryId = 'streamFactory';

const resolveBodyFactory = (container: Container): BodyFactory => {
  const id = container.has(bodyFactoryId) ? bodyFactoryId : streamFactoryId;

  return container.get<BodyFactory>(id);
};

// a registered service wins over the shipped factory, so that any part can be replaced or shared between services

export const acceptLanguageNegotiationMiddlewareServiceFactory = createAbstractFactory(
  (container: Container, { resolveDependency }): Middleware => {
    return createAcceptLanguageNegotiationMiddleware({
      serverRequestHelpers: container.get<ServerRequestHelpers>(serverRequestHelpersId),
      acceptLanguageNegotiator: resolveDependency(
        container,
        'acceptLanguageNegotiator',
        acceptLanguageNegotiatorServiceFactory,
      ),
    });
  },
);

export const acceptNegotiationMiddlewareServiceFactory = createAbstractFactory(
  (container: Container, { resolveDependency }): Middleware => {
    return createAcceptNegotiationMiddleware({
      serverRequestHelpers: container.get<ServerRequestHelpers>(serverRequestHelpersId),
      acceptNegotiator: resolveDependency(container, 'acceptNegotiator', acceptNegotiatorServiceFactory),
    });
  },
);

export const contentTypeNegotiationMiddlewareServiceFactory = createAbstractFactory(
  (container: Container, { resolveDependency }): Middleware => {
    return createContentTypeNegotiationMiddleware({
      serverRequestHelpers: container.get<ServerRequestHelpers>(serverRequestHelpersId),
      contentTypeNegotiator: resolveDependency(container, 'contentTypeNegotiator', contentTypeNegotiatorServiceFactory),
    });
  },
);

export const mapToHttpErrorServiceFactory = createAbstractFactory((): MapToHttpError => {
  return (e: unknown) => {
    throw e;
  };
});

export const errorMiddlewareLoggableAttributeNamesServiceFactory = createAbstractFactory((): Array<string> => {
  return [];
});

export const errorMiddlewareServiceFactory = createAbstractFactory(
  (container: Container, { resolveDependency }): Middleware => {
    const { debug = false } = container.get<Config>('config');

    return createErrorMiddleware({
      responseFactory: container.get<ResponseFactory>(responseFactoryId),
      bodyFactory: resolveBodyFactory(container),
      responseHelpers: container.get<ResponseHelpers>(responseHelpersId),
      encoder: resolveDependency(container, 'encoder', encoderServiceFactory),
      mapToHttpError: resolveDependency(container, 'mapToHttpError', mapToHttpErrorServiceFactory),
      debug,
      logger: container.has('logger') ? container.get<Logger>('logger') : undefined,
      loggableAttributeNames: resolveDependency(
        container,
        'errorMiddlewareLoggableAttributeNames',
        errorMiddlewareLoggableAttributeNamesServiceFactory,
      ),
    });
  },
);
