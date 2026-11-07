import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { describe, expect, test } from 'vitest';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/dist/function-mock';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import { z } from 'zod';
import {
  createServerRequest,
  readBody,
  responseFactory,
  responseHelpers,
  serverRequestHelpers,
  bodyFactory,
} from '../http.js';
import { createReadHandler } from '../../src/handler/read.js';
import { createEnrichedModelSchema, stringSchema, type EnrichModel, type Model } from '../../src/model.js';
import type { FindModelById } from '../../src/repository.js';

describe('read', () => {
  describe('createReadHandler', () => {
    const inputModelSchema = z.object({ name: stringSchema });
    const enrichedModelSchema = createEnrichedModelSchema(inputModelSchema);

    test('successfully', async () => {
      const id = '93cf0de1-e83e-4f68-800d-835e055a6fe8';
      const createdAt = new Date('2022-06-11T12:36:26.012Z');
      const updatedAt = new Date('2022-06-11T12:36:26.012Z');
      const name = 'name1';

      const model: Model<typeof inputModelSchema> = {
        id,
        createdAt,
        updatedAt,
        name,
      };

      const modelResponse = {
        ...model,
        createdAt: model.createdAt.toJSON(),
        updatedAt: model.createdAt.toJSON(),
      };

      const serverRequest = createServerRequest(`https://example.com/${id}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        attributes: { accept: 'application/json', id },
      });

      const [findModelById, findModelByIdMocks] = useFunctionMock<FindModelById<typeof inputModelSchema>>([
        {
          parameters: [id],
          return: Promise.resolve(model),
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          callback: (givenData, givenContentType) => {
            expect(givenData).toEqual({
              ...modelResponse,
              _embedded: {
                key: 'value',
              },
            });

            expect(givenContentType).toBe('application/json');

            return JSON.stringify(givenData);
          },
        },
      ]);

      const [enrichModel, enrichModelMocks] = useFunctionMock<EnrichModel<typeof inputModelSchema>>([
        {
          callback: async (givenModel, givenContext) => {
            expect(givenModel).toEqual(model);
            expect(givenContext).toBeUndefined();

            return {
              ...givenModel,
              _embedded: { key: 'value' },
            };
          },
        },
      ]);

      const readHandler = createReadHandler<typeof inputModelSchema>({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        findModelById,
        enrichedModelSchema,
        encoder,
        enrichModel,
      });

      const response = await readHandler(serverRequest);

      expect(response.status).toBe(200);
      expect(response.reasonPhrase).toBe('OK');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({
        ...modelResponse,
        _embedded: {
          key: 'value',
        },
      });

      expect(findModelByIdMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(enrichModelMocks).toHaveLength(0);
    });

    test('successfully without enrich model', async () => {
      const id = '93cf0de1-e83e-4f68-800d-835e055a6fe8';
      const createdAt = new Date('2022-06-11T12:36:26.012Z');
      const updatedAt = new Date('2022-06-11T12:36:26.012Z');
      const name = 'name1';

      const model: Model<typeof inputModelSchema> = {
        id,
        createdAt,
        updatedAt,
        name,
      };

      const modelResponse = {
        ...model,
        createdAt: model.createdAt.toJSON(),
        updatedAt: model.createdAt.toJSON(),
      };

      const serverRequest = createServerRequest(`https://example.com/${id}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        attributes: { accept: 'application/json', id },
      });

      const [findModelById, findModelByIdMocks] = useFunctionMock<FindModelById<typeof inputModelSchema>>([
        {
          parameters: [id],
          return: Promise.resolve(model),
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          callback: (givenData, givenContentType) => {
            expect(givenData).toEqual(modelResponse);

            expect(givenContentType).toBe('application/json');

            return JSON.stringify(givenData);
          },
        },
      ]);

      const readHandler = createReadHandler<typeof inputModelSchema>({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        findModelById,
        enrichedModelSchema,
        encoder,
      });

      const response = await readHandler(serverRequest);

      expect(response.status).toBe(200);
      expect(response.reasonPhrase).toBe('OK');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual(modelResponse);

      expect(findModelByIdMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('not found', async () => {
      const id = '93cf0de1-e83e-4f68-800d-835e055a6fe8';

      const serverRequest = createServerRequest(`https://example.com/${id}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        attributes: { accept: 'application/json', id },
      });

      const [findModelById, findModelByIdMocks] = useFunctionMock<FindModelById<typeof inputModelSchema>>([
        {
          parameters: [id],
          return: Promise.resolve(undefined),
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

      const readHandler = createReadHandler({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        findModelById,
        enrichedModelSchema,
        encoder,
      });

      try {
        await readHandler(serverRequest);
        throw new Error('Expect fail');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "NotFound",
            "detail": "There is no entry with id "93cf0de1-e83e-4f68-800d-835e055a6fe8"",
            "status": 404,
            "title": "Not Found",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.5",
          }
        `);
      }

      expect(findModelByIdMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });
  });
});
