# Typed

`createTypedHandler` is the generic building block behind the CRUD handlers of this library. It turns a set of [zod][2] schemas plus a plain async function into a [@chubbyts/chubbyts-http-types][1] `Handler`.

Reach for it when the CRUD handlers do not fit: custom status codes, additional route attributes, validated headers, a response without a body, or business logic beyond find / persist / remove.

## How it works

```ts
import { createTypedHandler } from '@chubbyts/chubbyts-http-api/handler/typed';

const handler = createTypedHandler({
  request: {
    attributes, // required: zod object schema for serverRequest.attributes
    headers,    // optional: zod object schema for the request headers
    query,      // optional: zod object schema for the query params (parsed by getQueryParams)
    body,       // optional: zod object schema for the decoded request body
  },
  response: {
    headers,    // optional: zod object schema for the response headers
    body,       // optional: zod object schema for the response body
  },
  handler: async ({ attributes, headers, query, body }) => ({ status, reasonPhrase, headers, body }),
  decoder,      // required when request.body is set
  encoder,      // required when response.body is set
  // the implementation of @chubbyts/chubbyts-http-types (e.g. @chubbyts/chubbyts-http)
  serverRequestHelpers, // required: reads the request headers and query params
  responseFactory,      // required: creates the response
  responseHelpers,      // required: sets the response headers and body
  streamFactory,        // required when response.body is set: creates the response body
});
```

Per request it:

 1. Parses `serverRequest.attributes` with `request.attributes`.
 2. Parses the request headers (multiple values joined with `, `), the query params (parsed by the implementation through `getQueryParams`) and the decoded body with the given schemas. Each failure throws a `400 Bad Request` with `invalidParameters` and a `context` of `headers`, `query` or `body`; a body the decoder can not parse throws a `400 Bad Request` with `context` `body` and the decoder message as `detail`.
 3. Calls your `handler` with the fully typed values.
 4. Parses the returned `headers` and `body` with the response schemas, encodes the body with the negotiated `accept` content type and returns a `Response`, created through the injected `responseFactory`, `responseHelpers` and `streamFactory`.

Which shape you get is determined by the presence of `request.body` and `response.body`. The attributes schema has to include what the variant needs:

| `request.body` | `response.body` | Required attributes       | Required codecs        |
|----------------|-----------------|---------------------------|------------------------|
| yes            | yes             | `contentType`, `accept`   | `decoder`, `encoder`   |
| yes            | no              | `contentType`             | `decoder`              |
| no             | yes             | `accept`                  | `encoder`              |
| no             | no              | –                         | –                      |

The `attributes` schema may of course declare more keys, like `id` for a route parameter.

## Usage

A pet API with embedded vaccinations. The five handlers below are functionally what `createListHandler`, `createCreateHandler`, `createReadHandler`, `createUpdateHandler` and `createDeleteHandler` do.

```ts
import { STATUS_CODES } from 'node:http';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { createResponseFactory, createStreamFactory } from '@chubbyts/chubbyts-http/message-factory';
import { createResponseHelpers, createServerRequestHelpers } from '@chubbyts/chubbyts-http/message-helper';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import { z } from 'zod';
import { v7 as uuid } from 'uuid';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createTypedHandler } from '@chubbyts/chubbyts-http-api/handler/typed';
import type {
  EnrichedModel,
  EnrichedModelList,
  EnrichedModelListSchema,
  EnrichedModelSchema,
  InputModel,
  InputModelList,
  Model,
  ModelList,
} from '@chubbyts/chubbyts-http-api/model';
import {
  createEnrichedModelListSchema,
  createEnrichedModelSchema,
  dateSchema,
  numberSchema,
  sortSchema,
  stringSchema,
} from '@chubbyts/chubbyts-http-api/model';

// vaccination: a second model that gets embedded into a pet

const inputVaccinationSchema = z.object({ name: stringSchema });

type InputVaccinationSchema = typeof inputVaccinationSchema;

export type Vaccination = Model<InputVaccinationSchema>;

type EnrichedVaccinationSchema = EnrichedModelSchema<InputVaccinationSchema>;

const enrichedVaccinationSchema: EnrichedVaccinationSchema = createEnrichedModelSchema(inputVaccinationSchema);

export type EnrichedVaccination = EnrichedModel<InputVaccinationSchema>;

// pet

const inputPetSchema = z
  .object({
    name: stringSchema,
    tag: stringSchema.optional(),
    vaccinations: z.array(
      z
        .object({
          id: stringSchema,
          injectedAt: dateSchema,
        })
        .strict(),
    ),
  })
  .strict();

type InputPetSchema = typeof inputPetSchema;

export type InputPet = InputModel<InputPetSchema>;

const inputPetListSchema = z
  .object({
    offset: numberSchema.default(0),
    limit: numberSchema.default(20),
    filters: z.object({ name: stringSchema.optional() }).strict().default({}),
    sort: z.object({ name: sortSchema }).strict().default({}),
  })
  .strict();

type InputPetListSchema = typeof inputPetListSchema;

export type InputPetList = InputModelList<InputPetListSchema>;

export type Pet = Model<InputPetSchema>;

export type PetList = ModelList<InputPetSchema, InputPetListSchema>;

// typed _embedded for the enriched pet

const embeddedPetSchema = z
  .object({
    vaccinations: z.array(enrichedVaccinationSchema.optional()),
  })
  .strict()
  .optional();

type EmbeddedPetSchema = typeof embeddedPetSchema;

type EnrichedPetSchema = EnrichedModelSchema<InputPetSchema>;

const enrichedPetSchema: EnrichedPetSchema = createEnrichedModelSchema(inputPetSchema, embeddedPetSchema);

export type EnrichedPet = EnrichedModel<InputPetSchema, EmbeddedPetSchema>;

type EnrichedPetListSchema = EnrichedModelListSchema<InputPetSchema, InputPetListSchema, EmbeddedPetSchema>;

const enrichedPetListSchema: EnrichedPetListSchema = createEnrichedModelListSchema(
  inputPetSchema,
  inputPetListSchema,
  embeddedPetSchema,
);

export type EnrichedPetList = EnrichedModelList<InputPetSchema, InputPetListSchema, EmbeddedPetSchema>;

// repository / enrichment contracts

export type EnrichPet = (pet: Pet) => Promise<EnrichedPet>;
export type EnrichPetList = (petList: PetList) => Promise<EnrichedPetList>;
export type FindPetById = (id: string) => Promise<Pet | undefined>;
export type PersistPet = (pet: Pet) => Promise<Pet>;
export type RemovePet = (pet: Pet) => Promise<void>;
export type ResolvePetList = (inputPetList: InputPetList) => Promise<PetList>;

// the implementation of @chubbyts/chubbyts-http-types

const http = {
  serverRequestHelpers: createServerRequestHelpers(),
  responseFactory: createResponseFactory(),
  responseHelpers: createResponseHelpers(),
  streamFactory: createStreamFactory(),
};

// handlers

export const createPetListHandler = (
  resolvePetList: ResolvePetList,
  enrichPetList: EnrichPetList,
  encoder: Encoder,
): Handler => {
  return createTypedHandler({
    ...http,
    request: {
      attributes: z.object({ accept: z.string() }),
      query: inputPetListSchema,
    },
    response: {
      body: enrichedPetListSchema,
    },
    handler: async ({ query }) => {
      const petList = await resolvePetList(query);
      const enrichedPetList = await enrichPetList(petList);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedPetList,
      };
    },
    encoder,
  });
};

export const createPetCreateHandler = (
  decoder: Decoder,
  persistPet: PersistPet,
  enrichPet: EnrichPet,
  encoder: Encoder,
): Handler => {
  return createTypedHandler({
    ...http,
    request: {
      attributes: z.object({ contentType: z.string(), accept: z.string() }),
      body: inputPetSchema,
    },
    response: {
      body: enrichedPetSchema,
    },
    handler: async ({ body }) => {
      const persistedPet = await persistPet({ ...body, id: uuid(), createdAt: new Date(), updatedAt: undefined });
      const enrichedPet = await enrichPet(persistedPet);

      return {
        status: 201,
        reasonPhrase: STATUS_CODES[201],
        body: enrichedPet,
      };
    },
    decoder,
    encoder,
  });
};

export const createPetReadHandler = (findPetById: FindPetById, enrichPet: EnrichPet, encoder: Encoder): Handler => {
  return createTypedHandler({
    ...http,
    request: {
      attributes: z.object({ accept: z.string(), id: z.string() }),
    },
    response: {
      body: enrichedPetSchema,
    },
    handler: async ({ attributes }) => {
      const pet = await findPetById(attributes.id);

      if (!pet) {
        throw createNotFound({ detail: `There is no pet with id "${attributes.id}"` });
      }

      const enrichedPet = await enrichPet(pet);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedPet,
      };
    },
    encoder,
  });
};

export const createPetUpdateHandler = (
  decoder: Decoder,
  findPetById: FindPetById,
  persistPet: PersistPet,
  enrichPet: EnrichPet,
  encoder: Encoder,
): Handler => {
  return createTypedHandler({
    ...http,
    request: {
      attributes: z.object({ contentType: z.string(), accept: z.string(), id: z.string() }),
      body: inputPetSchema,
    },
    response: {
      body: enrichedPetSchema,
    },
    handler: async ({ attributes, body }) => {
      const pet = await findPetById(attributes.id);

      if (!pet) {
        throw createNotFound({ detail: `There is no pet with id "${attributes.id}"` });
      }

      const persistedPet = await persistPet({
        ...body,
        id: pet.id,
        createdAt: pet.createdAt,
        updatedAt: new Date(),
      });

      const enrichedPet = await enrichPet(persistedPet);

      return {
        status: 200,
        reasonPhrase: STATUS_CODES[200],
        body: enrichedPet,
      };
    },
    decoder,
    encoder,
  });
};

export const createPetDeleteHandler = (findPetById: FindPetById, removePet: RemovePet): Handler => {
  return createTypedHandler({
    ...http,
    request: {
      attributes: z.object({ id: z.string() }),
    },
    response: {},
    handler: async ({ attributes }) => {
      const pet = await findPetById(attributes.id);

      if (!pet) {
        throw createNotFound({ detail: `There is no pet with id "${attributes.id}"` });
      }

      await removePet(pet);

      return {
        status: 204,
        reasonPhrase: STATUS_CODES[204],
      };
    },
  });
};
```

[1]: https://www.npmjs.com/package/@chubbyts/chubbyts-http-types
[2]: https://www.npmjs.com/package/zod
