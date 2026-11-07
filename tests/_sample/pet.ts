import { STATUS_CODES } from 'node:http';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import { z } from 'zod';
import { v7 as uuid } from 'uuid';
import { createNotFound } from '@chubbyts/chubbyts-http-error/dist/http-error';
import { createTypedHandler } from '../../src/handler/typed.js';
import type {
  EnrichedModel,
  EnrichedModelList,
  EnrichedModelListSchema,
  EnrichedModelSchema,
  InputModel,
  InputModelList,
  Model,
  ModelList,
} from '../../src/model.js';
import {
  createEnrichedModelListSchema,
  createEnrichedModelSchema,
  dateSchema,
  numberSchema,
  sortSchema,
  stringSchema,
} from '../../src/model.js';
import { responseFactory, responseHelpers, serverRequestHelpers, streamFactory } from '../http.js';

// the implementation of @chubbyts/chubbyts-http-types the handlers get created with
const implementation = { serverRequestHelpers, responseFactory, responseHelpers };

const implementationWithStreamFactory = { ...implementation, streamFactory };

const inputVaccinationSchema = z.object({ name: stringSchema });

type InputVaccinationSchema = typeof inputVaccinationSchema;

export type Vaccination = Model<InputVaccinationSchema>;

type EnrichedVaccinationSchema = EnrichedModelSchema<InputVaccinationSchema>;

const enrichedVaccinationSchema: EnrichedVaccinationSchema = createEnrichedModelSchema(inputVaccinationSchema);

export type EnrichedVaccination = EnrichedModel<InputVaccinationSchema>;

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

export type EnrichPet = (pet: Pet) => Promise<EnrichedPet>;
export type EnrichPetList = (petList: PetList) => Promise<EnrichedPetList>;
export type FindPetById = (id: string) => Promise<Pet | undefined>;
export type PersistPet = (pet: Pet) => Promise<Pet>;
export type RemovePet = (pet: Pet) => Promise<void>;
export type ResolvePetList = (inputPetList: InputPetList) => Promise<PetList>;

export const createPetListHandler = (
  resolvePetList: ResolvePetList,
  enrichPetList: EnrichPetList,
  encoder: Encoder,
): Handler => {
  return createTypedHandler({
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
    ...implementationWithStreamFactory,
  });
};

export const createPetCreateHandler = (
  decoder: Decoder,
  persistPet: PersistPet,
  enrichPet: EnrichPet,
  encoder: Encoder,
): Handler => {
  return createTypedHandler({
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
    ...implementationWithStreamFactory,
  });
};

export const createPetReadHandler = (findPetById: FindPetById, enrichPet: EnrichPet, encoder: Encoder): Handler => {
  return createTypedHandler({
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
    ...implementationWithStreamFactory,
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
    ...implementationWithStreamFactory,
  });
};

export const createPetDeleteHandler = (findPetById: FindPetById, removePet: RemovePet): Handler => {
  return createTypedHandler({
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
    ...implementation,
  });
};
