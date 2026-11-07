import { STATUS_CODES } from 'node:http';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import { z } from 'zod';
import type { ResolveModelList } from '../repository.js';
import type {
  EmbeddedSchema,
  EnrichedModelList,
  EnrichedModelListSchema,
  EnrichModelList,
  InputModelListSchema,
  InputModelSchema,
} from '../model.js';
import { createTypedHandler } from './typed.js';

export type ListHandlerConfig<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  streamFactory: StreamFactory;
  inputModelListSchema: IMLS;
  resolveModelList: ResolveModelList<IMS, IMLS>;
  enrichedModelListSchema: EnrichedModelListSchema<IMS, IMLS, EMS, EMLS>;
  encoder: Encoder;
  enrichModelList?: EnrichModelList<IMS, IMLS, EMS, EMLS>;
};

export const createListHandler = <
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
>({
  serverRequestHelpers,
  responseFactory,
  responseHelpers,
  streamFactory,
  inputModelListSchema,
  resolveModelList,
  enrichedModelListSchema,
  encoder,
  enrichModelList = (list) => Promise.resolve(list as EnrichedModelList<IMS, IMLS, EMS, EMLS>),
}: ListHandlerConfig<IMS, IMLS, EMS, EMLS>): Handler => {
  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    streamFactory,
    request: {
      attributes: z.object({ accept: z.string() }),
      query: inputModelListSchema,
    },
    response: {
      body: enrichedModelListSchema,
    },
    handler: async ({ query }) => {
      const modelList = await resolveModelList(query);
      const enrichedModelList = await enrichModelList(modelList);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedModelList,
      };
    },
    encoder,
  });
};
