import { STATUS_CODES } from 'node:http';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import { z } from 'zod';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { FindModelById, PersistModel } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichModel, EnrichedModelSchema, InputModelSchema } from '../model.js';
import { createTypedHandler } from './typed.js';

export type UpdateHandlerConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  streamFactory: StreamFactory;
  findModelById: FindModelById<IMS>;
  decoder: Decoder;
  inputModelSchema: IMS;
  persistModel: PersistModel<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
};

export const createUpdateHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>({
  serverRequestHelpers,
  responseFactory,
  responseHelpers,
  streamFactory,
  findModelById,
  decoder,
  inputModelSchema,
  persistModel,
  enrichedModelSchema,
  encoder,
  enrichModel = (model) => Promise.resolve(model as EnrichedModel<IMS, EMS>),
}: UpdateHandlerConfig<IMS, EMS>): Handler => {
  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    streamFactory,
    request: {
      attributes: z.object({ contentType: z.string(), accept: z.string(), id: z.string() }),
      body: inputModelSchema,
    },
    response: {
      body: enrichedModelSchema,
    },
    handler: async ({ attributes, body }) => {
      const model = await findModelById(attributes.id);

      if (!model) {
        throw createNotFound({ detail: `There is no entry with id "${attributes.id}"` });
      }

      const persistedModel = await persistModel({
        ...body,
        id: model.id,
        createdAt: model.createdAt,
        updatedAt: new Date(),
      });

      const enrichedModel = await enrichModel(persistedModel);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedModel,
      };
    },
    decoder,
    encoder,
  });
};
