import { STATUS_CODES } from 'node:http';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import { z } from 'zod';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { FindModelById, PersistModel } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichModel, EnrichedModelSchema, InputModelSchema } from '../model.js';
import type { BodyFactoryConfig, StreamFactoryConfig } from '../response.js';
import { resolveBodyFactory } from '../response.js';
import { createTypedHandler } from './typed.js';

type UpdateHandlerBaseConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  findModelById: FindModelById<IMS>;
  decoder: Decoder;
  inputModelSchema: IMS;
  persistModel: PersistModel<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
};

/** With the body factory under its deprecated name `streamFactory`, see `UpdateHandlerBodyFactoryConfig`. */
export type UpdateHandlerConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = UpdateHandlerBaseConfig<IMS, EMS> & StreamFactoryConfig;

export type UpdateHandlerBodyFactoryConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = UpdateHandlerBaseConfig<IMS, EMS> & BodyFactoryConfig;

export const createUpdateHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>(
  config: UpdateHandlerBodyFactoryConfig<IMS, EMS> | UpdateHandlerConfig<IMS, EMS>,
): Handler => {
  const {
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    findModelById,
    decoder,
    inputModelSchema,
    persistModel,
    enrichedModelSchema,
    encoder,
    enrichModel = (model) => Promise.resolve(model as EnrichedModel<IMS, EMS>),
  } = config;

  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    bodyFactory: resolveBodyFactory(config),
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
