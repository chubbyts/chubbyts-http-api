import { text } from 'node:stream/consumers';
import {
  createResponseFactory,
  createServerRequestFactory,
  createBodyFactory,
} from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers, createServerRequestHelpers } from '@chubbyts/chubbyts-http/message-helper';
import type { Attributes, Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';

// @chubbyts/chubbyts-http is used as implementation of @chubbyts/chubbyts-http-types within the tests

export const serverRequestFactory = createServerRequestFactory();
export const serverRequestHelpers = createServerRequestHelpers();
export const responseFactory = createResponseFactory();
export const responseHelpers = createResponseHelpers();
export const bodyFactory = createBodyFactory();

export const createServerRequest = <A extends Attributes = Attributes>(
  uri: string,
  {
    method = 'GET',
    headers = {},
    attributes = {} as A,
    body,
  }: { method?: string; headers?: Record<string, string>; attributes?: A; body?: string } = {},
): ServerRequest<A> => {
  const serverRequest = Object.entries(headers).reduce(
    (request, [name, value]) => serverRequestHelpers.withHeader(request, name, value),
    serverRequestFactory(method, uri),
  );

  const serverRequestWithBody =
    body !== undefined ? serverRequestHelpers.withBody(serverRequest, bodyFactory(body)) : serverRequest;

  return { ...serverRequestWithBody, attributes };
};

export const createResponse = (
  status = 200,
  { headers = {}, body }: { headers?: Record<string, string>; body?: string } = {},
): Response => {
  const response = Object.entries(headers).reduce(
    (current, [name, value]) => responseHelpers.withHeader(current, name, value),
    responseFactory(status),
  );

  return body !== undefined ? responseHelpers.withBody(response, bodyFactory(body)) : response;
};

export const readBody = (message: { body: AsyncIterable<Uint8Array> }): Promise<string> => text(message.body);
