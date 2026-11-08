import { text } from 'node:stream/consumers';
import type { Decoder } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import { DecodeError } from '@chubbyts/chubbyts-decode-encode/decoder/decoder';
import type { Encoder } from '@chubbyts/chubbyts-decode-encode/encoder/encoder';
import { createBadRequest } from '@chubbyts/chubbyts-http-error/http-error';
import type { Handler } from '@chubbyts/chubbyts-http-types/handler';
import type { Response, ServerRequest } from '@chubbyts/chubbyts-http-types/message';
import type { ResponseFactory } from '@chubbyts/chubbyts-http-types/message-factory';
import type { ResponseHelpers, ServerRequestHelpers } from '@chubbyts/chubbyts-http-types/message-helper';
import type { z } from 'zod';
import { zodToInvalidParameters } from '../zod-to-invalid-parameters.js';
import type { BodyFactoryConfig, StreamFactoryConfig } from '../response.js';
import { resolveBodyFactory, valueToData, withHeaders } from '../response.js';

type ObjectSchema = z.ZodType<{ [key: string]: unknown }>;

type HeadersSchema = z.ZodType<{ [key: string]: string }>;

type ContentTypeAttributesSchema = z.ZodType<{ contentType: string }>;

type AcceptAttributesSchema = z.ZodType<{ accept: string }>;

type ContentTypeAndAcceptAttributesSchema = z.ZodType<{ contentType: string; accept: string }>;

// the implementation of @chubbyts/chubbyts-http-types: the request gets read, the response gets created and changed
// through it only
type Implementation = {
  serverRequestHelpers: ServerRequestHelpers;
  responseFactory: ResponseFactory;
  responseHelpers: ResponseHelpers;
};

// the body factory, or the deprecated stream factory
type FactoryConfig = BodyFactoryConfig | StreamFactoryConfig;

type ResponseOutput<S> = S extends z.ZodType ? z.output<S> : { [key: string]: never };

type RequestSchema<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
> = {
  attributes: RequestAttributesSchema;
  headers?: RequestHeadersSchema;
  query?: RequestQuerySchema;
};

type RequestWithBodySchema<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema,
> = RequestSchema<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema> & {
  body: RequestBodySchema;
};

type ResponseSchema<ResponseHeadersSchema extends HeadersSchema | undefined> = {
  headers?: ResponseHeadersSchema;
};

type ResponseWithBodySchema<
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema,
> = ResponseSchema<ResponseHeadersSchema> & {
  body: ResponseBodySchema;
};

type HandlerRequest<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
> = {
  attributes: z.output<RequestAttributesSchema>;
  headers: z.output<RequestHeadersSchema>;
  query: z.output<RequestQuerySchema>;
};

type HandlerRequestWithBody<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema,
> = HandlerRequest<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema> & {
  body: z.output<RequestBodySchema>;
};

type HandlerResponseBase<ResponseHeadersSchema extends HeadersSchema | undefined> = {
  status: number;
  reasonPhrase?: string;
  headers?: ResponseOutput<ResponseHeadersSchema>;
};

type HandlerResponseWithBody<ResponseHeadersSchema extends HeadersSchema | undefined, ResponseBody> = Promise<
  HandlerResponseBase<ResponseHeadersSchema> & { body: ResponseBody }
>;

type HandlerResponse<ResponseHeadersSchema extends HeadersSchema | undefined, ResponseBody> = [ResponseBody] extends [
  undefined,
]
  ? Promise<HandlerResponseBase<ResponseHeadersSchema>>
  : HandlerResponseWithBody<ResponseHeadersSchema, ResponseBody>;

type WithRequestAndResponse<
  RequestAttributesSchema extends ContentTypeAndAcceptAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema,
  Factory extends FactoryConfig = FactoryConfig,
> = {
  request: RequestWithBodySchema<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema, RequestBodySchema>;
  response: ResponseWithBodySchema<ResponseHeadersSchema, ResponseBodySchema>;
  handler: (
    request: HandlerRequestWithBody<
      RequestAttributesSchema,
      RequestHeadersSchema,
      RequestQuerySchema,
      RequestBodySchema
    >,
  ) => HandlerResponseWithBody<ResponseHeadersSchema, z.output<ResponseBodySchema>>;
  decoder: Decoder;
  encoder: Encoder;
} & Implementation &
  Factory;

type WithRequestOnly<
  RequestAttributesSchema extends ContentTypeAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema,
  ResponseHeadersSchema extends HeadersSchema | undefined,
> = {
  request: RequestWithBodySchema<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema, RequestBodySchema>;
  response: ResponseSchema<ResponseHeadersSchema>;
  handler: (
    request: HandlerRequestWithBody<
      RequestAttributesSchema,
      RequestHeadersSchema,
      RequestQuerySchema,
      RequestBodySchema
    >,
  ) => HandlerResponse<ResponseHeadersSchema, undefined>;
  decoder: Decoder;
} & Implementation;

type WithResponseOnly<
  RequestAttributesSchema extends AcceptAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema,
  Factory extends FactoryConfig = FactoryConfig,
> = {
  request: RequestSchema<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema>;
  response: ResponseWithBodySchema<ResponseHeadersSchema, ResponseBodySchema>;
  handler: (
    request: HandlerRequest<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema>,
  ) => HandlerResponseWithBody<ResponseHeadersSchema, z.output<ResponseBodySchema>>;
  encoder: Encoder;
} & Implementation &
  Factory;

type WithNeither<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
> = {
  request: RequestSchema<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema>;
  response: ResponseSchema<ResponseHeadersSchema>;
  handler: (
    request: HandlerRequest<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema>,
  ) => HandlerResponse<ResponseHeadersSchema, undefined>;
} & Implementation;

type TypedHandlerFactoryConfig<
  Factory extends FactoryConfig,
  RequestAttributesSchema extends ObjectSchema | undefined,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema | undefined,
> = RequestAttributesSchema extends ContentTypeAndAcceptAttributesSchema
  ? RequestBodySchema extends ObjectSchema
    ? ResponseBodySchema extends ObjectSchema
      ? WithRequestAndResponse<
          RequestAttributesSchema,
          RequestHeadersSchema,
          RequestQuerySchema,
          RequestBodySchema,
          ResponseHeadersSchema,
          ResponseBodySchema,
          Factory
        >
      : never
    : never
  : RequestAttributesSchema extends ContentTypeAttributesSchema
    ? RequestBodySchema extends ObjectSchema
      ? ResponseBodySchema extends undefined
        ? WithRequestOnly<
            RequestAttributesSchema,
            RequestHeadersSchema,
            RequestQuerySchema,
            RequestBodySchema,
            ResponseHeadersSchema
          >
        : never
      : never
    : RequestAttributesSchema extends AcceptAttributesSchema
      ? RequestBodySchema extends undefined
        ? ResponseBodySchema extends ObjectSchema
          ? WithResponseOnly<
              RequestAttributesSchema,
              RequestHeadersSchema,
              RequestQuerySchema,
              ResponseHeadersSchema,
              ResponseBodySchema,
              Factory
            >
          : never
        : never
      : RequestAttributesSchema extends ObjectSchema
        ? RequestBodySchema extends undefined
          ? ResponseBodySchema extends undefined
            ? WithNeither<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema, ResponseHeadersSchema>
            : never
          : never
        : never;

/** With the body factory under its deprecated name `streamFactory`, see `TypedHandlerBodyFactoryConfig`. */
export type TypedHandlerConfig<
  RequestAttributesSchema extends ObjectSchema | undefined,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema | undefined,
> = TypedHandlerFactoryConfig<
  StreamFactoryConfig,
  RequestAttributesSchema,
  RequestHeadersSchema,
  RequestQuerySchema,
  RequestBodySchema,
  ResponseHeadersSchema,
  ResponseBodySchema
>;

export type TypedHandlerBodyFactoryConfig<
  RequestAttributesSchema extends ObjectSchema | undefined,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema | undefined,
> = TypedHandlerFactoryConfig<
  BodyFactoryConfig,
  RequestAttributesSchema,
  RequestHeadersSchema,
  RequestQuerySchema,
  RequestBodySchema,
  ResponseHeadersSchema,
  ResponseBodySchema
>;

const resolveRequestHeaders = (
  serverRequestHelpers: ServerRequestHelpers,
  serverRequest: ServerRequest,
  request: { headers?: HeadersSchema },
): z.output<HeadersSchema> => {
  if (undefined === request.headers) {
    return {};
  }

  // multiple values of a header get joined with ', ' (like the fetch api does)
  const requestHeadersResult = request.headers.safeParse(
    Object.fromEntries(
      Object.keys(serverRequest.headers).map((name) => [name, serverRequestHelpers.getHeaderLine(serverRequest, name)]),
    ),
  );

  if (!requestHeadersResult.success) {
    throw createBadRequest({
      invalidParameters: zodToInvalidParameters(requestHeadersResult.error),
      context: 'headers',
    });
  }

  return requestHeadersResult.data;
};

const resolveRequestQuery = (
  serverRequestHelpers: ServerRequestHelpers,
  serverRequest: ServerRequest,
  request: { query?: ObjectSchema },
): z.output<ObjectSchema> => {
  if (undefined === request.query) {
    return {};
  }

  // the query gets parsed by the implementation (nested keys like `key[sub]=value`, see the types)
  const requestQueryResult = request.query.safeParse(serverRequestHelpers.getQueryParams(serverRequest));

  if (!requestQueryResult.success) {
    throw createBadRequest({
      invalidParameters: zodToInvalidParameters(requestQueryResult.error),
      context: 'query',
    });
  }

  return requestQueryResult.data;
};

// malformed (or empty) bodies are a client error, not a server one
const decodeRequestBody = (decoder: Decoder, encodedBody: string, contentType: string): unknown => {
  try {
    return decoder.decode(encodedBody, contentType);
  } catch (e) {
    if (e instanceof DecodeError) {
      throw createBadRequest({ detail: e.message, context: 'body' });
    }

    throw e;
  }
};

const resolveRequestBody = async (
  serverRequest: ServerRequest,
  decoder: Decoder,
  contentType: string,
  body: ObjectSchema,
): Promise<z.output<ObjectSchema>> => {
  const requestBodyResult = body.safeParse(decodeRequestBody(decoder, await text(serverRequest.body), contentType));

  if (!requestBodyResult.success) {
    throw createBadRequest({
      invalidParameters: zodToInvalidParameters(requestBodyResult.error),
      context: 'body',
    });
  }

  return requestBodyResult.data;
};

const createResponse = (
  implementation: Implementation,
  typedResponse: { status: number; reasonPhrase?: string },
  headers: Record<string, string>,
): Response =>
  withHeaders(
    implementation.responseHelpers,
    implementation.responseFactory(typedResponse.status, typedResponse.reasonPhrase),
    headers,
  );

const createResponseWithBody = (
  implementation: Implementation & FactoryConfig,
  typedResponse: { status: number; reasonPhrase?: string },
  headers: Record<string, string>,
  body: string,
): Response =>
  implementation.responseHelpers.withBody(
    createResponse(implementation, typedResponse, headers),
    resolveBodyFactory(implementation)(body),
  );

export function createTypedHandler<
  RequestAttributesSchema extends ContentTypeAndAcceptAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined = undefined,
  RequestQuerySchema extends ObjectSchema | undefined = undefined,
  RequestBodySchema extends ObjectSchema = ObjectSchema,
  ResponseHeadersSchema extends HeadersSchema | undefined = undefined,
  ResponseBodySchema extends ObjectSchema = ObjectSchema,
>(
  _: WithRequestAndResponse<
    RequestAttributesSchema,
    RequestHeadersSchema,
    RequestQuerySchema,
    RequestBodySchema,
    ResponseHeadersSchema,
    ResponseBodySchema
  >,
): Handler;
export function createTypedHandler<
  RequestAttributesSchema extends ContentTypeAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined = undefined,
  RequestQuerySchema extends ObjectSchema | undefined = undefined,
  RequestBodySchema extends ObjectSchema = ObjectSchema,
  ResponseHeadersSchema extends HeadersSchema | undefined = undefined,
>(
  _: WithRequestOnly<
    RequestAttributesSchema,
    RequestHeadersSchema,
    RequestQuerySchema,
    RequestBodySchema,
    ResponseHeadersSchema
  >,
): Handler;
export function createTypedHandler<
  RequestAttributesSchema extends AcceptAttributesSchema,
  RequestHeadersSchema extends HeadersSchema | undefined = undefined,
  RequestQuerySchema extends ObjectSchema | undefined = undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined = undefined,
  ResponseBodySchema extends ObjectSchema = ObjectSchema,
>(
  _: WithResponseOnly<
    RequestAttributesSchema,
    RequestHeadersSchema,
    RequestQuerySchema,
    ResponseHeadersSchema,
    ResponseBodySchema
  >,
): Handler;
export function createTypedHandler<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined = undefined,
  RequestQuerySchema extends ObjectSchema | undefined = undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined = undefined,
>(_: WithNeither<RequestAttributesSchema, RequestHeadersSchema, RequestQuerySchema, ResponseHeadersSchema>): Handler;
export function createTypedHandler<
  RequestAttributesSchema extends ObjectSchema,
  RequestHeadersSchema extends HeadersSchema | undefined,
  RequestQuerySchema extends ObjectSchema | undefined,
  RequestBodySchema extends ObjectSchema | undefined,
  ResponseHeadersSchema extends HeadersSchema | undefined,
  ResponseBodySchema extends ObjectSchema | undefined,
>(
  _: TypedHandlerFactoryConfig<
    FactoryConfig,
    RequestAttributesSchema,
    RequestHeadersSchema,
    RequestQuerySchema,
    RequestBodySchema,
    ResponseHeadersSchema,
    ResponseBodySchema
  >,
): Handler {
  return async (serverRequest: ServerRequest): Promise<Response> => {
    if (
      'decoder' in _ &&
      undefined !== _.decoder &&
      'body' in _.request &&
      undefined !== _.request.body &&
      'encoder' in _ &&
      undefined !== _.encoder &&
      'body' in _.response &&
      undefined !== _.response.body
    ) {
      const config = _ as WithRequestAndResponse<
        ContentTypeAndAcceptAttributesSchema,
        HeadersSchema | undefined,
        ObjectSchema | undefined,
        ObjectSchema,
        HeadersSchema | undefined,
        ObjectSchema
      >;
      const requestAttributes = config.request.attributes.parse(serverRequest.attributes);

      const typedResponse = await config.handler({
        attributes: requestAttributes,
        headers: resolveRequestHeaders(config.serverRequestHelpers, serverRequest, config.request),
        query: resolveRequestQuery(config.serverRequestHelpers, serverRequest, config.request),
        body: await resolveRequestBody(
          serverRequest,
          config.decoder,
          requestAttributes.contentType,
          config.request.body,
        ),
      });

      return createResponseWithBody(
        config,
        typedResponse,
        {
          'content-type': requestAttributes.accept,
          ...(config.response.headers ? config.response.headers.parse(typedResponse.headers) : {}),
        },
        config.encoder.encode(valueToData(config.response.body.parse(typedResponse.body)), requestAttributes.accept),
      );
    }

    if ('decoder' in _ && undefined !== _.decoder && 'body' in _.request && undefined !== _.request.body) {
      const config = _ as WithRequestOnly<
        ContentTypeAttributesSchema,
        HeadersSchema | undefined,
        ObjectSchema | undefined,
        ObjectSchema,
        HeadersSchema | undefined
      >;

      const requestAttributes = config.request.attributes.parse(serverRequest.attributes);

      const typedResponse = await config.handler({
        attributes: requestAttributes,
        headers: resolveRequestHeaders(config.serverRequestHelpers, serverRequest, config.request),
        query: resolveRequestQuery(config.serverRequestHelpers, serverRequest, config.request),
        body: await resolveRequestBody(
          serverRequest,
          config.decoder,
          requestAttributes.contentType,
          config.request.body,
        ),
      });

      return createResponse(
        config,
        typedResponse,
        config.response.headers ? config.response.headers.parse(typedResponse.headers) : {},
      );
    }

    if ('encoder' in _ && undefined !== _.encoder && 'body' in _.response && undefined !== _.response.body) {
      const config = _ as WithResponseOnly<
        AcceptAttributesSchema,
        HeadersSchema | undefined,
        ObjectSchema | undefined,
        HeadersSchema | undefined,
        ObjectSchema
      >;

      const requestAttributes = config.request.attributes.parse(serverRequest.attributes);

      const typedResponse = await config.handler({
        attributes: requestAttributes,
        headers: resolveRequestHeaders(config.serverRequestHelpers, serverRequest, config.request),
        query: resolveRequestQuery(config.serverRequestHelpers, serverRequest, config.request),
      });

      return createResponseWithBody(
        config,
        typedResponse,
        {
          'content-type': requestAttributes.accept,
          ...(config.response.headers ? config.response.headers.parse(typedResponse.headers) : {}),
        },
        config.encoder.encode(valueToData(config.response.body.parse(typedResponse.body)), requestAttributes.accept),
      );
    }

    const config = _ as WithNeither<
      ObjectSchema,
      HeadersSchema | undefined,
      ObjectSchema | undefined,
      HeadersSchema | undefined
    >;

    const requestAttributes = config.request.attributes.parse(serverRequest.attributes);

    const typedResponse = await config.handler({
      attributes: requestAttributes,
      headers: resolveRequestHeaders(config.serverRequestHelpers, serverRequest, config.request),
      query: resolveRequestQuery(config.serverRequestHelpers, serverRequest, config.request),
    });

    return createResponse(
      config,
      typedResponse,
      config.response.headers ? config.response.headers.parse(typedResponse.headers) : {},
    );
  };
}
