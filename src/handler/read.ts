import { STATUS_CODES } from 'node:http';
import { createNotFound } from '@chubbyts/chubbyts-http-error/http-error';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { z } from 'zod';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { FindModelById } from '../repository.js';
import type { EmbeddedSchema, EnrichedModel, EnrichedModelSchema, EnrichModel, InputModelSchema } from '../model.js';
import type { BodyFactoryConfig, StreamFactoryConfig } from '../response.js';
import { resolveBodyFactory } from '../response.js';
import { createTypedHandler } from './typed.js';

type ReadHandlerBaseConfig<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  findModelById: FindModelById<IMS>;
  enrichedModelSchema: EnrichedModelSchema<IMS, EMS>;
  encoder: Encoder;
  enrichModel?: EnrichModel<IMS, EMS>;
};

/** With the body factory under its deprecated name `streamFactory`, see `ReadHandlerBodyFactoryConfig`. */
export type ReadHandlerConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = ReadHandlerBaseConfig<IMS, EMS> & StreamFactoryConfig;

export type ReadHandlerBodyFactoryConfig<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = ReadHandlerBaseConfig<IMS, EMS> & BodyFactoryConfig;

export const createReadHandler = <IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema>(
  config: ReadHandlerBodyFactoryConfig<IMS, EMS> | ReadHandlerConfig<IMS, EMS>,
): Handler => {
  const {
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    findModelById,
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
