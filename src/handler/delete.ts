import { STATUS_CODES } from 'node:http';
import { createNotFound } from '@chubbyts/chubbyts-http-error/http-error';
import { z } from 'zod';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { FindModelById, RemoveModel } from '../repository.js';
import type { InputModelSchema } from '../model.js';
import { createTypedHandler } from './typed.js';

export type DeleteHandlerConfig<IMS extends InputModelSchema> = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
  findModelById: FindModelById<IMS>;
  removeModel: RemoveModel<IMS>;
};

export const createDeleteHandler = <IMS extends InputModelSchema>({
  serverRequestHelpers,
  responseFactory,
  responseHelpers,
  findModelById,
  removeModel,
}: DeleteHandlerConfig<IMS>): Handler => {
  return createTypedHandler({
    serverRequestHelpers,
    responseFactory,
    responseHelpers,
    request: {
      attributes: z.object({ id: z.string() }),
    },
    response: {},
    handler: async ({ attributes }) => {
      const model = await findModelById(attributes.id);

      if (!model) {
        throw createNotFound({ detail: `There is no entry with id "${attributes.id}"` });
      }

      await removeModel(model);

      return {
        status: 204,
        reasonPhrase: STATUS_CODES[204],
      };
    },
  });
};
