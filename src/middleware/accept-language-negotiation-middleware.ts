import type { Negotiator } from '@chubbyts/chubbyts-negotiation/negotiation';
import { createNotAcceptable } from '@chubbyts/chubbyts-http-error/http-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';

export type AcceptLanguageNegotiationMiddlewareConfig = {
  serverRequestHelpers: ServerRequestHelpers;
  acceptLanguageNegotiator: Negotiator;
};

export const createAcceptLanguageNegotiationMiddleware = ({
  serverRequestHelpers,
  acceptLanguageNegotiator,
}: AcceptLanguageNegotiationMiddlewareConfig): Middleware => {
  return async (serverRequest: ServerRequest, handler: Handler): Promise<Response> => {
    if (!serverRequestHelpers.hasHeader(serverRequest, 'accept-language')) {
      const supportedValues = acceptLanguageNegotiator.supportedValues;

      throw createNotAcceptable({
        detail: `Missing accept-language: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    const negotiatedValue = acceptLanguageNegotiator.negotiate(
      serverRequestHelpers.getHeaderLine(serverRequest, 'accept-language'),
    );

    if (!negotiatedValue) {
      const supportedValues = acceptLanguageNegotiator.supportedValues;

      throw createNotAcceptable({
        detail: `Allowed accept-languages: "${supportedValues.join('", "')}"`,
        supportedValues,
      });
    }

    return handler(serverRequestHelpers.withAttribute(serverRequest, 'acceptLanguage', negotiatedValue.value));
  };
};
