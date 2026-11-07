import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { HttpError } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { useFunctionMock } from '@chubbyts/chubbyts-function-mock/dist/function-mock';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import {
  createServerRequest,
  readBody,
  responseFactory,
  responseHelpers,
  serverRequestHelpers,
  bodyFactory,
} from '../http.js';
import { createCreateHandler } from '../../src/handler/create.js';
import { type EnrichModel, stringSchema, createEnrichedModelSchema } from '../../src/model.js';
import type { PersistModel } from '../../src/repository.js';

describe('create', () => {
  describe('createCreateHandler', () => {
    const inputModelSchema = z.object({ name: stringSchema });
    const embeddedModelSchema = z.object({ key: stringSchema }).optional();
    const enrichedModelSchema = createEnrichedModelSchema(inputModelSchema, embeddedModelSchema);

    test('successfully', async () => {
      const newName = 'name1';

      const inputData = { name: newName };
      const encodedInputData = JSON.stringify(inputData);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        attributes: { accept: 'application/json', contentType: 'application/json' },
        body: encodedInputData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedInputData, 'application/json'], return: inputData },
      ]);

      const [persistModel, persistModelMocks] = useFunctionMock<PersistModel<typeof inputModelSchema>>([
        {
          callback: async (givenModel) => {
            expect(givenModel).toEqual({
              id: expect.any(String),
              createdAt: expect.any(Date),
              name: newName,
            });

            return givenModel;
          },
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          callback: (givenData, givenContentType) => {
            expect(givenData).toEqual({
              id: expect.any(String),
              createdAt: expect.any(String),
              name: newName,
              _embedded: { key: 'value' },
            });

            expect(givenContentType).toBe('application/json');

            return JSON.stringify(givenData);
          },
        },
      ]);

      const [enrichModel, enrichModelMocks] = useFunctionMock<
        EnrichModel<typeof inputModelSchema, typeof embeddedModelSchema>
      >([
        {
          callback: async (givenModel, givenContext) => {
            expect(givenModel).toEqual({
              id: expect.any(String),
              createdAt: expect.any(Date),
              name: newName,
            });

            expect(givenContext).toBeUndefined();

            return {
              ...givenModel,
              _embedded: { key: 'value' },
            };
          },
        },
      ]);

      const createHandler = createCreateHandler({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        decoder,
        inputModelSchema,
        persistModel,
        enrichedModelSchema,
        encoder,
        enrichModel,
      });

      const response = await createHandler(serverRequest);

      expect(response.status).toBe(201);
      expect(response.reasonPhrase).toBe('Created');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      const responseBody = JSON.parse(await readBody(response));

      expect(responseBody).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        name: newName,
        _embedded: {
          key: 'value',
        },
      });

      expect((responseBody as { id: string }).id[14]).toBe('7');

      expect(decoderMocks).toHaveLength(0);
      expect(persistModelMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
      expect(enrichModelMocks).toHaveLength(0);
    });

    test('successfully without enrich mode', async () => {
      const newName = 'name1';

      const inputData = { name: newName };
      const encodedInputData = JSON.stringify(inputData);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        attributes: { accept: 'application/json', contentType: 'application/json' },
        body: encodedInputData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedInputData, 'application/json'], return: inputData },
      ]);

      const [persistModel, persistModelMocks] = useFunctionMock<PersistModel<typeof inputModelSchema>>([
        {
          callback: async (givenModel) => {
            expect(givenModel).toEqual({
              id: expect.any(String),
              createdAt: expect.any(Date),
              name: newName,
            });

            return givenModel;
          },
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        {
          name: 'encode',
          callback: (givenData, givenContentType) => {
            expect(givenData).toEqual({
              id: expect.any(String),
              createdAt: expect.any(String),
              name: newName,
            });

            expect(givenContentType).toBe('application/json');

            return JSON.stringify(givenData);
          },
        },
      ]);

      const createHandler = createCreateHandler({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        decoder,
        inputModelSchema,
        persistModel,
        enrichedModelSchema,
        encoder,
      });

      const response = await createHandler(serverRequest);

      expect(response.status).toBe(201);
      expect(response.reasonPhrase).toBe('Created');
      expect(response.headers).toMatchInlineSnapshot(`
        {
          "content-type": [
            "application/json",
          ],
        }
      `);

      expect(JSON.parse(await readBody(response))).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        name: newName,
      });

      expect(decoderMocks).toHaveLength(0);
      expect(persistModelMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('could not parse', async () => {
      const inputData = { key: 'value' };
      const encodedInputData = JSON.stringify(inputData);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        attributes: { accept: 'application/json', contentType: 'application/json' },
        body: encodedInputData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedInputData, 'application/json'], return: inputData },
      ]);

      const [persistModel, persistModelMocks] = useFunctionMock<PersistModel<typeof inputModelSchema>>([]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([]);

      const createHandler = createCreateHandler({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        decoder,
        inputModelSchema,
        persistModel,
        enrichedModelSchema,
        encoder,
      });

      try {
        await createHandler(serverRequest);
        throw new Error('Expect Error');
      } catch (e) {
        expect({ ...(e as HttpError) }).toMatchInlineSnapshot(`
          {
            "_httpError": "BadRequest",
            "context": "body",
            "invalidParameters": [
              {
                "context": {
                  "code": "invalid_type",
                  "expected": "string",
                },
                "name": "name",
                "reason": "Invalid input: expected string, received undefined",
              },
            ],
            "status": 400,
            "title": "Bad Request",
            "type": "https://datatracker.ietf.org/doc/html/rfc2616#section-10.4.1",
          }
        `);
      }

      expect(decoderMocks).toHaveLength(0);
      expect(persistModelMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });

    test('does not let the body override id and createdAt', async () => {
      const looseInputModelSchema = z.object({ name: stringSchema }).loose();
      const inputData = { name: 'name1', id: 'client-id', createdAt: '2000-01-01T00:00:00.000Z' };
      const encodedInputData = JSON.stringify(inputData);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        attributes: { accept: 'application/json', contentType: 'application/json' },
        body: encodedInputData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedInputData, 'application/json'], return: inputData },
      ]);

      const [persistModel, persistModelMocks] = useFunctionMock<PersistModel<typeof looseInputModelSchema>>([
        {
          callback: async (givenModel) => {
            expect(givenModel.id).toBe('server-id');
            expect(givenModel.createdAt).toBeInstanceOf(Date);

            return { name: givenModel.name, id: givenModel.id, createdAt: givenModel.createdAt };
          },
        },
      ]);

      const [encoder, encoderMocks] = useObjectMock<Encoder>([
        { name: 'encode', callback: (givenData) => JSON.stringify(givenData) },
      ]);

      const createHandler = createCreateHandler({
        serverRequestHelpers,
        responseFactory,
        responseHelpers,
        bodyFactory,
        decoder,
        inputModelSchema: looseInputModelSchema,
        persistModel,
        enrichedModelSchema: createEnrichedModelSchema(looseInputModelSchema),
        encoder,
        uuid: () => 'server-id',
      });

      const response = await createHandler(serverRequest);

      expect(response.status).toBe(201);

      expect(decoderMocks).toHaveLength(0);
      expect(persistModelMocks).toHaveLength(0);
      expect(encoderMocks).toHaveLength(0);
    });
  });
});
