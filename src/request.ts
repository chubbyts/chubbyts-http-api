import { text } from 'node:stream/consumers';
import type { Data } from '@chubbyts/chubbyts-decode-encode/data';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { ServerRequest } from '@chubbyts/chubbyts-http-types/message';

export const parseRequestBody = async (
  decoder: Decoder,
  serverRequest: ServerRequest<{ readonly contentType?: string }>,
): Promise<Data> => {
  const { contentType } = serverRequest.attributes;

  if (!contentType) {
    throw new Error('Use createContentTypeNegotiationMiddleware to assign request.attributes.contentType.');
  }

  return decoder.decode(await text(serverRequest.body), contentType, { serverRequest });
};
