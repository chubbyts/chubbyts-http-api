import { STATUS_CODES } from 'node:http';
import { v7 } from 'uuid';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/dist/encoder/encoder';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/dist/decoder/decoder';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import { z } from 'zod';
import type { PersistModel } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichedModelSchema, EnrichModel, InputModelSchema } from '../model.js';
import { createTypedHandler } from './typed.js';

export type CreateHandlerConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  streamFactory: StreamFactory;
  decoder: Decoder;
  inputModelSchema: IMS;
  persistModel: PersistModel<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
  uuid?: () => string;
};

export const createCreateHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>({
  serverRequestHelpers,
  responseFactory,
  responseHelpers,
  streamFactory,
  decoder,
  inputModelSchema,
  persistModel,
  enrichedModelSchema,
  encoder,
  enrichModel = (model) => Promise.resolve(model as EnrichedModel<IMS, EMS>),
  uuid = v7,
}: CreateHandlerConfig<IMS, EMS>): Handler => {
  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    streamFactory,
    request: {
      attributes: z.object({ contentType: z.string(), accept: z.string() }),
      body: inputModelSchema,
    },
    response: {
      body: enrichedModelSchema,
    },
    handler: async ({ body }) => {
      const persistedModel = await persistModel({ ...body, id: uuid(), createdAt: new Date() });
      const enrichedModel = await enrichModel(persistedModel);

      return {
        status: 201,
        reasonPhrase: STATUS_CODES[201],
        body: enrichedModel,
      };
    },
    decoder,
    encoder,
  });
};
