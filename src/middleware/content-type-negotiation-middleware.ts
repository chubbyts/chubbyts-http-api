import type { Negotiator } from '@chubbyts/chubbyts-negotiation/negotiation';
import { createUnsupportedMediaType } from '@chubbyts/chubbyts-http-error/http-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';

export type ContentTypeNegotiationMiddlewareConfig = {
  serverRequestHelpers: ServerRequestHelpers;
  contentTypeNegotiator: Negotiator;
};

export const createContentTypeNegotiationMiddleware = ({
  serverRequestHelpers,
  contentTypeNegotiator,
}: ContentTypeNegotiationMiddlewareConfig): Middleware => {
  return async (serverRequest: ServerRequest, handler: Handler): Promise<Response> => {
    if (!serverRequestHelpers.hasHeader(serverRequest, 'content-type')) {
      const supportedValues = contentTypeNegotiator.supportedValues;

      throw createUnsupportedMediaType({
        detail: `Missing content-type: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    const negotiatedValue = contentTypeNegotiator.negotiate(
      serverRequestHelpers.getHeaderLine(serverRequest, 'content-type'),
    );

    if (!negotiatedValue) {
      const supportedValues = contentTypeNegotiator.supportedValues;

      throw createUnsupportedMediaType({
        detail: `Allowed content-types: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    return handler(serverRequestHelpers.withAttribute(serverRequest, 'contentType', negotiatedValue.value));
  };
};
