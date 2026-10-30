import type { Negotiator } from '@chubbyts/chubbyts-negotiation/dist/negotiation';
import { createNotAcceptable } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';

export type AcceptNegotiationMiddlewareConfig = {
  serverRequestHelpers: ServerRequestHelpers;
  acceptNegotiator: Negotiator;
};

export const createAcceptNegotiationMiddleware = ({
  serverRequestHelpers,
  acceptNegotiator,
}: AcceptNegotiationMiddlewareConfig): Middleware => {
  return async (serverRequest: ServerRequest, handler: Handler): Promise<Response> => {
    if (!serverRequestHelpers.hasHeader(serverRequest, 'accept')) {
      const supportedValues = acceptNegotiator.supportedValues;

      throw createNotAcceptable({
        detail: `Missing accept: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    const negotiatedValue = acceptNegotiator.negotiate(serverRequestHelpers.getHeaderLine(serverRequest, 'accept'));

    if (!negotiatedValue) {
      const supportedValues = acceptNegotiator.supportedValues;

      throw createNotAcceptable({
        detail: `Allowed accepts: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    return handler(serverRequestHelpers.withAttribute(serverRequest, 'accept', negotiatedValue.value));
  };
};
