import { STATUS_CODES } from 'node:http';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
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
import type { BodyFactoryConfig, StreamFactoryConfig } from '../response.js';
import { resolveBodyFactory } from '../response.js';
import { createTypedHandler } from './typed.js';

type ListHandlerBaseConfig<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  inputModelListSchema: IMLS;
  resolveModelList: ResolveModelList<IMS, IMLS>;
  enrichedModelListSchema: EnrichedModelListSchema<IMS, IMLS, EMS, EMLS>;
  encoder: Encoder;
  enrichModelList?: EnrichModelList<IMS, IMLS, EMS, EMLS>;
};

/** With the body factory under its deprecated name `streamFactory`, see `ListHandlerBodyFactoryConfig`. */
export type ListHandlerConfig<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = ListHandlerBaseConfig<IMS, IMLS, EMS, EMLS> & StreamFactoryConfig;

export type ListHandlerBodyFactoryConfig<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = ListHandlerBaseConfig<IMS, IMLS, EMS, EMLS> & BodyFactoryConfig;

export const createListHandler = <
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
>(
  config: ListHandlerBodyFactoryConfig<IMS, IMLS, EMS, EMLS> | ListHandlerConfig<IMS, IMLS, EMS, EMLS>,
): Handler => {
  const {
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    inputModelListSchema,
    resolveModelList,
    enrichedModelListSchema,
    encoder,
    enrichModelList = (list) => Promise.resolve(list as EnrichedModelList<IMS, IMLS, EMS, EMLS>),
  } = config;

  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    bodyFactory: resolveBodyFactory(config),
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
