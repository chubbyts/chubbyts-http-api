import type { Data } from '@chubbyts/chubbyts-decode-encode/data';
import { isObject, isArray, isBoolean, isNumber, isString } from '@chubbyts/chubbyts-decode-encode/data';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { EncodeError } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { isHttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
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

export type ResponseWithDataConfig = {
  responseFactory: ResponseFactory;
  streamFactory: StreamFactory;
  responseHelpers: ResponseHelpers;
  serverRequest: ServerRequest<{ readonly accept?: string }>;
  encoder: Encoder;
  data: Data;
  status: number;
  reasonPhrase?: string;
  headers?: Record<string, string>;
};

export const createResponseWithData = ({
  responseFactory,
  streamFactory,
  responseHelpers,
  serverRequest,
  encoder,
  data,
  status,
  reasonPhrase,
  headers = {},
}: ResponseWithDataConfig): Response => {
  const { accept } = serverRequest.attributes;

  if (!accept) {
    throw new Error('Use createAcceptNegotiationMiddleware to assign request.attributes.accept.');
  }

  // created and changed through the injected implementation only: works with any of them
  return responseHelpers.withBody(
    withHeaders(responseHelpers, responseFactory(status, reasonPhrase), { ...headers, 'content-type': accept }),
    streamFactory(encoder.encode(data, accept, { serverRequest })),
  );
};
