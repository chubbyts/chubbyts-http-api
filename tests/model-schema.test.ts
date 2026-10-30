import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { createModelSchema, stringSchema } from '../src/model.js';

describe('createModelSchema', () => {
  test('creates a usable model schema', async () => {
    const modelSchema = createModelSchema(z.object({ name: stringSchema }).strict());

    expect(modelSchema.parse({ id: 'id1', createdAt: new Date('2025-07-15T10:00:00.000Z'), name: 'test1' }))
      .toMatchInlineSnapshot(`
        {
          "createdAt": 2025-07-15T10:00:00.000Z,
          "id": "id1",
          "name": "test1",
        }
      `);
  });
});
