import { STATUS_CODES } from 'node:http';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createInternalServerError, isHttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/dist/encoder/encoder';
import type { Logger } from '@chubbyts/chubbyts-log-types/dist/log';
import { createLogger } from '@chubbyts/chubbyts-log-types/dist/log';
import { throwableToError } from '@chubbyts/chubbyts-throwable-to-error/dist/throwable-to-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest, Uri } from '@chubbyts/chubbyts-http-types/message';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { Middleware } from '@chubbyts/chubbyts-http-types/middleware';
import { valueToData, withHeaders } from '../response.js';

export type MapToHttpError = (e: unknown) => HttpError;

const eToHttpError = (e: unknown, mapToHttpError: MapToHttpError): HttpError => {
  if (isHttpError(e)) {
    return e;
  }

  try {
    return mapToHttpError(e);
  } catch (mapError) {
    const error = throwableToError(mapError);

    return createInternalServerError({ error: { name: error.name, message: error.message, stack: error.stack } });
  }
};

const resolvePathnameSearch = (uri: Uri): string => (uri.query ? `${uri.path}?${uri.query}` : uri.path);

export type ErrorMiddlewareConfig = {
  responseFactory: ResponseFactory;
  streamFactory: StreamFactory;
  responseHelpers: ResponseHelpers;
  encoder: Encoder;
  mapToHttpError?: MapToHttpError;
  debug?: boolean;
  logger?: Logger;
  loggableAttributeNames?: Array<string>;
};

export const createErrorMiddleware = ({
  responseFactory,
  streamFactory,
  responseHelpers,
  encoder,
  mapToHttpError = (e: unknown) => {
    throw e;
  },
  debug = false,
  logger = createLogger(),
  loggableAttributeNames = [],
}: ErrorMiddlewareConfig): Middleware => {
  return async (serverRequest: ServerRequest, handler: Handler): Promise<Response> => {
    try {
      return await handler(serverRequest);
    } catch (e) {
      const httpError = eToHttpError(e, mapToHttpError);
      const isClientError = httpError.status < 500;

      logger[isClientError ? 'info' : 'error']('Http Error', {
        method: serverRequest.method,
        pathnameSearch: resolvePathnameSearch(serverRequest.uri),
        ...Object.fromEntries(
          loggableAttributeNames.map((name) => [name, serverRequest.attributes[name] ?? undefined]),
        ),
        ...httpError,
      });

      const { headers: _, ...rest } = httpError;

      // the accept negotiation could have failed (406) or not run yet: fall back to the first encoder content type
      const accept = (serverRequest.attributes.accept as string | undefined) ?? encoder.contentTypes[0];

      if (!accept) {
        throw e;
      }

      // created and changed through the injected implementation only: works with any of them
      return responseHelpers.withBody(
        withHeaders(responseHelpers, responseFactory(httpError.status, STATUS_CODES[httpError.status]), {
          ...httpError.headers,
          'content-type': accept,
        }),
        streamFactory(
          encoder.encode(
            valueToData(
              isClientError || debug
                ? rest
                : { type: httpError.type, status: httpError.status, title: httpError.title },
            ),
            accept,
            { serverRequest },
          ),
        ),
      );
    }
  };
};
