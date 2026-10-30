import { isArray, isBoolean, isNull, isNumber, isObject, isString } from '@chubbyts/chubbyts-decode-encode/dist/data';
import type { z } from 'zod';

type InvalidParameter = {
  name: string;
  reason: string;
  [key: string]: unknown;
};

const resolveName = (path: Array<PropertyKey>): string => {
  return path
    .map((pathPart, i) => {
      return i > 0 ? `[${pathPart.toString()}]` : pathPart;
    })
    .join('');
};

const filterContext = (rest: unknown): unknown => {
  if (isObject(rest)) {
    return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, filterContext(value)]));
  }

  if (isArray(rest)) {
    return rest.map(filterContext);
  }

  if (isNull(rest) || isBoolean(rest) || isNumber(rest) || isString(rest)) {
    return rest;
  }

  if (rest instanceof Date) {
    return rest.toJSON();
  }

  return '**filtered**';
};

export const zodToInvalidParameters = <T>(zodError: z.ZodError<T>): Array<InvalidParameter> => {
  return zodError.issues.map((issue) => {
    const { path, message, ...context } = issue;

    return {
      name: resolveName(path),
      reason: message,
      context: filterContext(context),
    };
  });
};
