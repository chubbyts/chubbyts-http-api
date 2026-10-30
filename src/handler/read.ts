import { STATUS_CODES } from 'node:http';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/dist/encoder/encoder';
import { z } from 'zod';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory, StreamFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { FindModelById } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichedModelSchema, EnrichModel, InputModelSchema } from '../model.js';
import { createTypedHandler } from './typed.js';

export type ReadHandlerConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  streamFactory: StreamFactory;
  findModelById: FindModelById<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
};

export const createReadHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>({
  serverRequestHelpers,
  responseFactory,
  responseHelpers,
  streamFactory,
  findModelById,
  enrichedModelSchema,
  encoder,
  enrichModel = (model) => Promise.resolve(model as EnrichedModel<IMS, EMS>),
}: ReadHandlerConfig<IMS, EMS>): Handler => {
  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    streamFactory,
    request: {
      attributes: z.object({ accept: z.string(), id: z.string() }),
    },
    response: {
      body: enrichedModelSchema,
    },
    handler: async ({ attributes }) => {
      const model = await findModelById(attributes.id);

      if (!model) {
        throw createNotFound({ detail: `There is no entry with id "${attributes.id}"` });
      }

      const enrichedModel = await enrichModel(model);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedModel,
      };
    },
    encoder,
  });
};
