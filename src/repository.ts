import type { ModelList, Model, InputModelSchema, InputModelListSchema, InputModelList } from './model.js';

export type ResolveModelList<IMS extends InputModelSchema, IMLS extends InputModelListSchema> = (
  inputModelList: InputModelList<IMLS>,
) => Promise<ModelList<IMS, IMLS>>;

export type FindModelById<IMS extends InputModelSchema> = (id: string) => Promise<Model<IMS> | undefined>;

export type PersistModel<IMS extends InputModelSchema> = (model: Model<IMS>) => Promise<Model<IMS>>;

export type RemoveModel<IMS extends InputModelSchema> = (model: Model<IMS>) => Promise<void>;
