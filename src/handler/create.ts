import { STATUS_CODES } from 'node:http';
import { v7 } from 'uuid';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import { z } from 'zod';
import type { PersistModel } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichedModelSchema, EnrichModel, InputModelSchema } from '../model.js';
import type { BodyFactoryConfig, StreamFactoryConfig } from '../response.js';
import { resolveBodyFactory } from '../response.js';
import { createTypedHandler } from './typed.js';

type CreateHandlerBaseConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  decoder: Decoder;
  inputModelSchema: IMS;
  persistModel: PersistModel<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
  uuid?: () => string;
};

/** With the body factory under its deprecated name `streamFactory`, see `CreateHandlerBodyFactoryConfig`. */
export type CreateHandlerConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = CreateHandlerBaseConfig<IMS, EMS> & StreamFactoryConfig;

export type CreateHandlerBodyFactoryConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = CreateHandlerBaseConfig<IMS, EMS> & BodyFactoryConfig;

export const createCreateHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>(
  config: CreateHandlerBodyFactoryConfig<IMS, EMS> | CreateHandlerConfig<IMS, EMS>,
): Handler => {
  const {
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    decoder,
    inputModelSchema,
    persistModel,
    enrichedModelSchema,
    encoder,
    enrichModel = (model) => Promise.resolve(model as EnrichedModel<IMS, EMS>),
    uuid = v7,
  } = config;

  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    bodyFactory: resolveBodyFactory(config),
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
