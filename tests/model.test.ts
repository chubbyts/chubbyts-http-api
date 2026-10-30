import { describe, expect, test } from 'vitest';

import { z } from 'zod';
import {
  createEnrichedModelListSchema,
  createEnrichedModelSchema,
  createModelListSchema,
  createModelSchema,
  dateSchema,
  numberSchema,
  sortSchema,
  stringSchema,
} from '../src/model.js';

describe('model', () => {
  describe('stringSchema', () => {
    test('success', async () => {
      expect(stringSchema.parse('t')).toBe('t');
    });

    test('failed', async () => {
      try {
        stringSchema.parse('');
        throw new Error('expect fail');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(`
          [ZodError: [
            {
              "origin": "string",
              "code": "too_small",
              "minimum": 1,
              "inclusive": true,
              "path": [],
              "message": "Too small: expected string to have >=1 characters"
            }
          ]]
        `);
      }
    });
  });

  describe('numberSchema', () => {
    test('success', async () => {
      expect(numberSchema.parse('1')).toBe(1);
      expect(numberSchema.parse(1)).toBe(1);
    });

    test('failed', async () => {
      try {
        numberSchema.parse('t');
        throw new Error('expect fail');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(`
          [ZodError: [
            {
              "expected": "number",
              "code": "invalid_type",
              "received": "NaN",
              "path": [],
              "message": "Invalid input: expected number, received NaN"
            }
          ]]
        `);
      }
    });
  });

  describe('dateSchema', () => {
    test('success', async () => {
      const date = new Date();

      expect(dateSchema.parse(date)).toEqual(date);
      expect(dateSchema.parse(date.toJSON())).toEqual(date);
      expect(dateSchema.parse(date.getTime())).toEqual(date);
    });

    test('failed', async () => {
      try {
        dateSchema.parse('t');
        throw new Error('expect fail');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(`
          [ZodError: [
            {
              "expected": "date",
              "code": "invalid_type",
              "received": "Invalid Date",
              "path": [],
              "message": "Invalid input: expected date, received Date"
            }
          ]]
        `);
      }
    });
  });

  describe('sortSchema', () => {
    test('success', async () => {
      expect(sortSchema.parse('asc')).toBe('asc');
      expect(sortSchema.parse('desc')).toBe('desc');
    });

    test('failed', async () => {
      try {
        sortSchema.parse('');
        throw new Error('expect fail');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(`
          [ZodError: [
            {
              "code": "invalid_union",
              "errors": [
                [
                  {
                    "code": "invalid_value",
                    "values": [
                      "asc"
                    ],
                    "path": [],
                    "message": "Invalid input: expected \\"asc\\""
                  }
                ],
                [
                  {
                    "code": "invalid_value",
                    "values": [
                      "desc"
                    ],
                    "path": [],
                    "message": "Invalid input: expected \\"desc\\""
                  }
                ]
              ],
              "path": [],
              "message": "Invalid input"
            }
          ]]
        `);
      }
    });
  });

  describe('model schemas', () => {
    const inputModelSchema = z.object({ name: stringSchema }).strict();
    const inputModelListSchema = z
      .object({
        offset: numberSchema.default(0),
        limit: numberSchema.default(20),
        filters: z.object({ name: stringSchema.optional() }).strict().default({}),
        sort: z.object({ name: sortSchema }).strict().default({}),
      })
      .strict();

    const modelSchema = createModelSchema(inputModelSchema);
    const modelListSchema = createModelListSchema(inputModelSchema, inputModelListSchema);

    const enrichedModelSchema = createEnrichedModelSchema(inputModelSchema);
    const enrichedModelListSchema = createEnrichedModelListSchema(inputModelSchema, inputModelListSchema);

    describe('enrichedModel', () => {
      const createdAt = new Date('2025-07-15T10:00:00.000Z');
      const updatedAt = new Date('2025-07-15T10:05:00.000Z');

      const model1: z.infer<typeof modelSchema> = { id: 'id1', createdAt, name: 'test1' };
      const model2: z.infer<typeof modelSchema> = { id: 'id2', createdAt, updatedAt, name: 'test2' };

      const modelList: z.infer<typeof modelListSchema> = {
        offset: 0,
        limit: 20,
        filters: { name: 'test' },
        sort: { name: 'asc' },
        items: [model1, model2],
        count: 2,
      };

      describe('createModelSchema', () => {
        test('success', async () => {
          expect(modelSchema.parse(model1)).toMatchInlineSnapshot(`
            {
              "createdAt": 2025-07-15T10:00:00.000Z,
              "id": "id1",
              "name": "test1",
            }
          `);
          expect(modelSchema.parse(model2)).toMatchInlineSnapshot(`
            {
              "createdAt": 2025-07-15T10:00:00.000Z,
              "id": "id2",
              "name": "test2",
              "updatedAt": 2025-07-15T10:05:00.000Z,
            }
          `);
        });

        test('failed', async () => {
          try {
            modelSchema.parse({ id: 'id', createdAt, name: 'test', unknown: 'unknown' });
            throw new Error('expect fail');
          } catch (e) {
            expect(e).toMatchInlineSnapshot(`
              [ZodError: [
                {
                  "code": "unrecognized_keys",
                  "keys": [
                    "unknown"
                  ],
                  "path": [],
                  "message": "Unrecognized key: \\"unknown\\""
                }
              ]]
            `);
          }
        });
      });

      describe('createModelListSchema', () => {
        test('success', async () => {
          expect(modelListSchema.parse(modelList)).toMatchInlineSnapshot(`
            {
              "count": 2,
              "filters": {
                "name": "test",
              },
              "items": [
                {
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id1",
                  "name": "test1",
                },
                {
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id2",
                  "name": "test2",
                  "updatedAt": 2025-07-15T10:05:00.000Z,
                },
              ],
              "limit": 20,
              "offset": 0,
              "sort": {
                "name": "asc",
              },
            }
          `);
        });

        test('failed', async () => {
          try {
            modelListSchema.parse({
              ...modelList,
              unknown: 'unknown',
            });
            throw new Error('expect fail');
          } catch (e) {
            expect(e).toMatchInlineSnapshot(`
              [ZodError: [
                {
                  "code": "unrecognized_keys",
                  "keys": [
                    "unknown"
                  ],
                  "path": [],
                  "message": "Unrecognized key: \\"unknown\\""
                }
              ]]
            `);
          }
        });
      });
    });

    describe('enrichedModel', () => {
      const createdAt = new Date('2025-07-15T10:00:00.000Z');
      const updatedAt = new Date('2025-07-15T10:05:00.000Z');

      const enrichedModel1: z.infer<typeof enrichedModelSchema> = {
        id: 'id',
        createdAt,
        name: 'test',
      };

      const enrichedModel2: z.infer<typeof enrichedModelSchema> = {
        id: 'id',
        createdAt,
        updatedAt,
        name: 'test',
        _embedded: { key: 'value' },
        _links: {
          read: { href: '/api/model/id', name: 'read', templated: false },
          update: { href: '/api/model/id', key: 'value' },
          other: [{ href: '/api/model/id/some-thing' }, { href: '/api/model/id/another-thing' }],
        },
      };

      const enrichedModelList1: z.infer<typeof enrichedModelListSchema> = {
        offset: 0,
        limit: 20,
        filters: { name: 'test' },
        sort: { name: 'asc' },
        items: [enrichedModel1, enrichedModel2],
        count: 2,
      };

      const enrichedModelList2: z.infer<typeof enrichedModelListSchema> = {
        offset: 0,
        limit: 20,
        filters: { name: 'test' },
        sort: { name: 'asc' },
        items: [enrichedModel1, enrichedModel2],
        count: 2,
        _embedded: { key: 'value' },
        _links: {
          create: { href: '/api/model', name: 'create', templated: false },
          other: [{ href: '/api/model/id/some-list-thing' }, { href: '/api/model/id/another-list-thing' }],
        },
      };

      describe('createEnrichedModelSchema', () => {
        test('success', async () => {
          expect(enrichedModelSchema.parse(enrichedModel1)).toMatchInlineSnapshot(`
            {
              "createdAt": 2025-07-15T10:00:00.000Z,
              "id": "id",
              "name": "test",
            }
          `);
          expect(enrichedModelSchema.parse(enrichedModel2)).toMatchInlineSnapshot(`
            {
              "_embedded": {
                "key": "value",
              },
              "_links": {
                "other": [
                  {
                    "href": "/api/model/id/some-thing",
                  },
                  {
                    "href": "/api/model/id/another-thing",
                  },
                ],
                "read": {
                  "href": "/api/model/id",
                  "name": "read",
                  "templated": false,
                },
                "update": {
                  "href": "/api/model/id",
                  "key": "value",
                },
              },
              "createdAt": 2025-07-15T10:00:00.000Z,
              "id": "id",
              "name": "test",
              "updatedAt": 2025-07-15T10:05:00.000Z,
            }
          `);
        });

        test('failed', async () => {
          try {
            enrichedModelSchema.parse({ ...enrichedModel1, unknown: 'unknown' });
            throw new Error('expect fail');
          } catch (e) {
            expect(e).toMatchInlineSnapshot(`
              [ZodError: [
                {
                  "code": "unrecognized_keys",
                  "keys": [
                    "unknown"
                  ],
                  "path": [],
                  "message": "Unrecognized key: \\"unknown\\""
                }
              ]]
            `);
          }
        });

        test('failed with invalid link', async () => {
          try {
            enrichedModelSchema.parse({ ...enrichedModel1, _links: { read: { name: 'read' } } });
            throw new Error('expect fail');
          } catch (e) {
            expect(e).toMatchInlineSnapshot(`
              [ZodError: [
                {
                  "code": "invalid_union",
                  "errors": [
                    [
                      {
                        "expected": "string",
                        "code": "invalid_type",
                        "path": [
                          "href"
                        ],
                        "message": "Invalid input: expected string, received undefined"
                      }
                    ],
                    [
                      {
                        "expected": "array",
                        "code": "invalid_type",
                        "path": [],
                        "message": "Invalid input: expected array, received object"
                      }
                    ]
                  ],
                  "path": [
                    "_links",
                    "read"
                  ],
                  "message": "Invalid input"
                }
              ]]
            `);
          }
        });
      });

      describe('createEnrichedModelListSchema', () => {
        test('success', async () => {
          expect(enrichedModelListSchema.parse(enrichedModelList1)).toMatchInlineSnapshot(`
            {
              "count": 2,
              "filters": {
                "name": "test",
              },
              "items": [
                {
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id",
                  "name": "test",
                },
                {
                  "_embedded": {
                    "key": "value",
                  },
                  "_links": {
                    "other": [
                      {
                        "href": "/api/model/id/some-thing",
                      },
                      {
                        "href": "/api/model/id/another-thing",
                      },
                    ],
                    "read": {
                      "href": "/api/model/id",
                      "name": "read",
                      "templated": false,
                    },
                    "update": {
                      "href": "/api/model/id",
                      "key": "value",
                    },
                  },
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id",
                  "name": "test",
                  "updatedAt": 2025-07-15T10:05:00.000Z,
                },
              ],
              "limit": 20,
              "offset": 0,
              "sort": {
                "name": "asc",
              },
            }
          `);
          expect(enrichedModelListSchema.parse(enrichedModelList2)).toMatchInlineSnapshot(`
            {
              "_embedded": {
                "key": "value",
              },
              "_links": {
                "create": {
                  "href": "/api/model",
                  "name": "create",
                  "templated": false,
                },
                "other": [
                  {
                    "href": "/api/model/id/some-list-thing",
                  },
                  {
                    "href": "/api/model/id/another-list-thing",
                  },
                ],
              },
              "count": 2,
              "filters": {
                "name": "test",
              },
              "items": [
                {
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id",
                  "name": "test",
                },
                {
                  "_embedded": {
                    "key": "value",
                  },
                  "_links": {
                    "other": [
                      {
                        "href": "/api/model/id/some-thing",
                      },
                      {
                        "href": "/api/model/id/another-thing",
                      },
                    ],
                    "read": {
                      "href": "/api/model/id",
                      "name": "read",
                      "templated": false,
                    },
                    "update": {
                      "href": "/api/model/id",
                      "key": "value",
                    },
                  },
                  "createdAt": 2025-07-15T10:00:00.000Z,
                  "id": "id",
                  "name": "test",
                  "updatedAt": 2025-07-15T10:05:00.000Z,
                },
              ],
              "limit": 20,
              "offset": 0,
              "sort": {
                "name": "asc",
              },
            }
          `);
        });

        test('failed', async () => {
          try {
            enrichedModelListSchema.parse({ ...enrichedModelList1, unknown: 'unknown' });
            throw new Error('expect fail');
          } catch (e) {
            expect(e).toMatchInlineSnapshot(`
              [ZodError: [
                {
                  "code": "unrecognized_keys",
                  "keys": [
                    "unknown"
                  ],
                  "path": [],
                  "message": "Unrecognized key: \\"unknown\\""
                }
              ]]
            `);
          }
        });
      });
    });
  });
});
