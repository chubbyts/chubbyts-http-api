import type { Data } from '@chubbyts/chubbyts-decode-encode/data';
import { isObject, isArray, isBoolean, isNumber, isString } from '@chubbyts/chubbyts-decode-encode/data';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { EncodeError } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { isHttpError } from '@chubbyts/chubbyts-http-error/http-error';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ResponseFactory, BodyFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers } from '@chubbyts/chubbyts-http-types/message-helper';

export const valueToData = (value: unknown): Data => {
  if (value instanceof Date) {
    return value.toJSON();
  } else if (isHttpError(value)) {
    return valueToData({ ...value });
  } else if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([_, subValue]) => subValue !== undefined)
        .map(([subKey, subValue]) => [subKey, valueToData(subValue)]),
    );
  } else if (isArray(value)) {
    return value.filter((subValue) => subValue !== undefined).map(valueToData);
  } else if (isString(value) || isNumber(value) || isBoolean(value) || value === null) {
    return value;
  }

  throw new EncodeError(
    `Unsupported value of type ${typeof value === 'object' ? value.constructor.name : typeof value}`,
  );
};

export const withHeaders = (
  responseHelpers: ResponseHelpers,
  response: Response,
  headers: Record<string, string>,
): Response =>
  Object.entries(headers).reduce(
    (current, [name, value]) => responseHelpers.withHeader(current, name, value),
    response,
  );

/**
 * The body factory of the http-types implementation, if the deprecated `streamFactory` is given too `bodyFactory`
 * wins.
 */
export type BodyFactoryConfig = {
  bodyFactory: BodyFactory;
  /** @deprecated use `bodyFactory`, the body is not a stream anymore */
  streamFactory?: BodyFactory;
};

/** The body factory of the http-types implementation under its deprecated name `streamFactory`. */
export type StreamFactoryConfig = {
  /** @deprecated use `bodyFactory`, the body is not a stream anymore */
  streamFactory: BodyFactory;
};

export const resolveBodyFactory = (
  config: BodyFactoryConfig | (StreamFactoryConfig & { bodyFactory?: undefined }),
): BodyFactory => config.bodyFactory ?? config.streamFactory;

type ResponseWithDataBaseConfig = {
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  serverRequest: ServerRequest<{ readonly accept?: string }>;
  encoder: Encoder;
  data: Data;
  status: number;
  reasonPhrase?: string;
  headers?: Record<string, string>;
};

/** With the body factory under its deprecated name `streamFactory`, see `ResponseWithDataBodyFactoryConfig`. */
export type ResponseWithDataConfig = ResponseWithDataBaseConfig & StreamFactoryConfig;

export type ResponseWithDataBodyFactoryConfig = ResponseWithDataBaseConfig & BodyFactoryConfig;

export const createResponseWithData = (
  config: ResponseWithDataBodyFactoryConfig | ResponseWithDataConfig,
): Response => {
  const { responseFactory, responseHelpers, serverRequest, encoder, data, status, reasonPhrase, headers = {} } = config;
  const { accept } = serverRequest.attributes;

  if (!accept) {
    throw new Error('Use createAcceptNegotiationMiddleware to assign request.attributes.accept.');
  }

  // created and changed through the injected implementation only: works with any of them
  return responseHelpers.withBody(
    withHeaders(responseHelpers, responseFactory(status, reasonPhrase), { ...headers, 'content-type': accept }),
    resolveBodyFactory(config)(encoder.encode(data, accept, { serverRequest })),
  );
};
