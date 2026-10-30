import { z } from 'zod';

export const stringSchema = z.string().min(1);
export const numberSchema = z.coerce.number();
export const dateSchema = z.coerce.date();

type NumberSchema = z.ZodType<number>;
type DateSchema = z.ZodType<Date>;

export const sortSchema = z.union([z.literal('asc'), z.literal('desc')]).optional();

export type SortSchema = typeof sortSchema;
export type Sort = z.output<SortSchema>;

const embeddedSchema = z.object({}).loose().optional();

export type EmbeddedSchema = z.ZodOptional<z.ZodType<{ [key: string]: unknown }>>;

const linkSchema = z.intersection(
  z.object({
    href: z.string(),
    name: z.string().optional(),
    templated: z.boolean().optional(),
  }),
  z.record(z.string(), z.unknown()),
);

type LinkSchema = typeof linkSchema;

export type Link = z.output<LinkSchema>;

const linksSchema = z.record(z.string(), z.union([linkSchema, z.array(linkSchema)])).optional();

type LinksSchema = typeof linksSchema;

export type InputModelSchema = z.ZodObject<z.ZodRawShape>;

export type InputModel<IMS extends InputModelSchema> = z.output<IMS>;

type ModelShape<IMS extends InputModelSchema> = IMS['shape'] & {
  id: typeof stringSchema;
  createdAt: DateSchema;
  updatedAt: z.ZodOptional<DateSchema>;
};

export type InputModelListSchema = z.ZodObject<{
  offset: NumberSchema;
  limit: NumberSchema;
  filters: z.ZodType<{ [key: string]: unknown }>;
  sort: z.ZodType<{ [key: string]: Sort }>;
}>;

export type InputModelList<IMLS extends InputModelListSchema> = z.output<IMLS>;

export type ModelSchema<IMS extends InputModelSchema> = z.ZodObject<ModelShape<IMS>>;

export type Model<IMS extends InputModelSchema> = InputModel<IMS> & {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
};

export const createModelSchema = <IMS extends InputModelSchema>(inputModelSchema: IMS): ModelSchema<IMS> =>
  z
    .object({ ...inputModelSchema.shape, id: stringSchema, createdAt: dateSchema, updatedAt: dateSchema.optional() })
    .strict();

type ModelListShape<IMS extends InputModelSchema, IMLS extends InputModelListSchema> = IMLS['shape'] & {
  count: typeof numberSchema;
  items: z.ZodArray<ModelSchema<IMS>>;
};

export type ModelListSchema<IMS extends InputModelSchema, IMLS extends InputModelListSchema> = z.ZodObject<
  ModelListShape<IMS, IMLS>
>;

export type ModelList<IMS extends InputModelSchema, IMLS extends InputModelListSchema> = InputModelList<IMLS> & {
  count: number;
  items: Array<Model<IMS>>;
};

export const createModelListSchema = <IMS extends InputModelSchema, IMLS extends InputModelListSchema>(
  inputModelSchema: IMS,
  inputModelListSchema: IMLS,
): ModelListSchema<IMS, IMLS> =>
  z
    .object({
      ...inputModelListSchema.shape,
      count: numberSchema,
      items: z.array(createModelSchema(inputModelSchema)),
    })
    .strict();

type EnrichedModelShape<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = ModelShape<IMS> & {
  _embedded: EMS;
  _links: LinksSchema;
};

export type EnrichedModelSchema<
  IMS extends InputModelSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
> = z.ZodObject<EnrichedModelShape<IMS, EMS>>;

export type EnrichedModel<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = z.output<
  EnrichedModelSchema<IMS, EMS>
>;

export function createEnrichedModelSchema<IMS extends InputModelSchema>(
  inputModelSchema: IMS,
): EnrichedModelSchema<IMS>;
export function createEnrichedModelSchema<IMS extends InputModelSchema, EMS extends EmbeddedSchema>(
  inputModelSchema: IMS,
  embeddedModelSchema: EMS,
): EnrichedModelSchema<IMS, EMS>;
export function createEnrichedModelSchema<IMS extends InputModelSchema, EMS extends EmbeddedSchema>(
  inputModelSchema: IMS,
  embeddedModelSchema?: EMS,
) {
  return z
    .object({
      ...createModelSchema(inputModelSchema).shape,
      _embedded: embeddedModelSchema ?? embeddedSchema,
      _links: linksSchema,
    })
    .strict();
}

type EnrichedModelListShape<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = ModelListShape<IMS, IMLS> & {
  items: z.ZodArray<EnrichedModelSchema<IMS, EMS>>;
  _embedded: EMLS;
  _links: LinksSchema;
};

export type EnrichedModelListSchema<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = z.ZodObject<EnrichedModelListShape<IMS, IMLS, EMS, EMLS>>;

export type EnrichedModelList<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = z.output<EnrichedModelListSchema<IMS, IMLS, EMS, EMLS>>;

export function createEnrichedModelListSchema<IMS extends InputModelSchema, IMLS extends InputModelListSchema>(
  inputModelSchema: IMS,
  inputModelListSchema: IMLS,
): EnrichedModelListSchema<IMS, IMLS>;
export function createEnrichedModelListSchema<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
>(
  inputModelSchema: IMS,
  inputModelListSchema: IMLS,
  embeddedModelSchema: EMS,
  embeddedModelListSchema?: EMLS,
): EnrichedModelListSchema<IMS, IMLS, EMS, EMLS>;
export function createEnrichedModelListSchema<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema,
  EMLS extends EmbeddedSchema,
>(inputModelSchema: IMS, inputModelListSchema: IMLS, embeddedModelSchema?: EMS, embeddedModelListSchema?: EMLS) {
  return z
    .object({
      ...inputModelListSchema.shape,
      count: numberSchema,
      items: z.array(
        embeddedModelSchema
          ? createEnrichedModelSchema(inputModelSchema, embeddedModelSchema)
          : createEnrichedModelSchema(inputModelSchema),
      ),
      _embedded: embeddedModelListSchema ?? embeddedSchema,
      _links: linksSchema,
    })
    .strict();
}

export type EnrichModel<IMS extends InputModelSchema, EMS extends EmbeddedSchema = EmbeddedSchema> = (
  model: Model<IMS>,
  context?: { [key: string]: unknown },
) => Promise<EnrichedModel<IMS, EMS>>;

export type EnrichModelList<
  IMS extends InputModelSchema,
  IMLS extends InputModelListSchema,
  EMS extends EmbeddedSchema = EmbeddedSchema,
  EMLS extends EmbeddedSchema = EmbeddedSchema,
> = (
  list: ModelList<IMS, IMLS>,
  context?: { [key: string]: unknown },
) => Promise<EnrichedModelList<IMS, IMLS, EMS, EMLS>>;
