import { describe, expect, test } from 'vitest';
import { ZodError } from 'zod';
import { zodToInvalidParameters } from '../src/zod-to-invalid-parameters.js';

describe('zod-to-invalid-parameters', () => {
  describe('zodToInvalidParameters', () => {
    test('with one error', () => {
      const error = new ZodError([
        {
          code: 'custom',
          params: { null: null, bool: true, number: 42, string: 'test' },
          input: 'data',
          message: 'Custom',
          path: ['path', 'to', 'field'],
        },
      ]);

      expect(zodToInvalidParameters(error)).toMatchInlineSnapshot(`
        [
          {
            "context": {
              "code": "custom",
              "input": "data",
              "params": {
                "bool": true,
                "null": null,
                "number": 42,
                "string": "test",
              },
            },
            "name": "path[to][field]",
            "reason": "Custom",
          },
        ]
      `);
    });

    test('with multiple error', () => {
      const date = new Date('2025-07-15T10:00:00.000Z');

      // oxlint-disable-next-line functional/no-let
      let i = 0;
      const error = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          input: 'number',
          message: 'Invalid type',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'too_big',
          origin: 'int',
          maximum: 10,
          input: 12,
          message: 'Too big',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'too_small',
          origin: 'int',
          minimum: 10,
          input: 8,
          message: 'Too small',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'invalid_format',
          format: 'base64',
          input: 'abcdefghijklmnopqrstuvwxyz',
          message: 'Invalid format',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'not_multiple_of',
          divisor: 2,
          input: 5,
          message: 'Not multiple of',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'unrecognized_keys',
          keys: ['key1', 'key2'],
          input: { key3: '' },
          message: 'Unrecognized keys',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'invalid_union',
          errors: [
            [
              {
                code: 'custom',
                params: { key: 'value' },
                input: date,
                message: 'Custom',
                path: ['path', 'to', 'field'],
              },
            ],
          ],
          input: 'unknown',
          message: 'Invalid union',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'invalid_key',
          origin: 'record',
          issues: [
            {
              code: 'custom',
              params: { key: 'value' },
              input: new Map([]),
              message: 'Custom',
              path: ['path', 'to', 'field'],
            },
          ],
          input: {},

          message: 'Invalid key',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'invalid_element',
          origin: 'set',
          key: 2,
          issues: [
            {
              code: 'custom',
              params: { key: 'value' },
              input: 'data',
              message: 'Custom',
              path: ['path', 'to', 'field'],
            },
          ],
          input: {},

          message: 'Invalid element',
          path: ['path', 0, 'to', i++, 'field'],
        },
        {
          code: 'invalid_value',
          values: ['value1'],
          input: 'value2',
          message: 'Invalid value',
          path: ['path', 0, 'to', i, 'field'],
        },
        { code: 'custom', params: { key: 'value' }, input: 'data', message: 'Custom', path: ['path', 'to', 'field'] },
      ]);

      expect(zodToInvalidParameters(error)).toMatchInlineSnapshot(`
        [
          {
            "context": {
              "code": "invalid_type",
              "expected": "string",
              "input": "number",
            },
            "name": "path[0][to][0][field]",
            "reason": "Invalid type",
          },
          {
            "context": {
              "code": "too_big",
              "input": 12,
              "maximum": 10,
              "origin": "int",
            },
            "name": "path[0][to][1][field]",
            "reason": "Too big",
          },
          {
            "context": {
              "code": "too_small",
              "input": 8,
              "minimum": 10,
              "origin": "int",
            },
            "name": "path[0][to][2][field]",
            "reason": "Too small",
          },
          {
            "context": {
              "code": "invalid_format",
              "format": "base64",
              "input": "abcdefghijklmnopqrstuvwxyz",
            },
            "name": "path[0][to][3][field]",
            "reason": "Invalid format",
          },
          {
            "context": {
              "code": "not_multiple_of",
              "divisor": 2,
              "input": 5,
            },
            "name": "path[0][to][4][field]",
            "reason": "Not multiple of",
          },
          {
            "context": {
              "code": "unrecognized_keys",
              "input": {
                "key3": "",
              },
              "keys": [
                "key1",
                "key2",
              ],
            },
            "name": "path[0][to][5][field]",
            "reason": "Unrecognized keys",
          },
          {
            "context": {
              "code": "invalid_union",
              "errors": [
                [
                  {
                    "code": "custom",
                    "input": "2025-07-15T10:00:00.000Z",
                    "message": "Custom",
                    "params": {
                      "key": "value",
                    },
                    "path": [
                      "path",
                      "to",
                      "field",
                    ],
                  },
                ],
              ],
              "input": "unknown",
            },
            "name": "path[0][to][6][field]",
            "reason": "Invalid union",
          },
          {
            "context": {
              "code": "invalid_key",
              "input": {},
              "issues": [
                {
                  "code": "custom",
                  "input": "**filtered**",
                  "message": "Custom",
                  "params": {
                    "key": "value",
                  },
                  "path": [
                    "path",
                    "to",
                    "field",
                  ],
                },
              ],
              "origin": "record",
            },
            "name": "path[0][to][7][field]",
            "reason": "Invalid key",
          },
          {
            "context": {
              "code": "invalid_element",
              "input": {},
              "issues": [
                {
                  "code": "custom",
                  "input": "data",
                  "message": "Custom",
                  "params": {
                    "key": "value",
                  },
                  "path": [
                    "path",
                    "to",
                    "field",
                  ],
                },
              ],
              "key": 2,
              "origin": "set",
            },
            "name": "path[0][to][8][field]",
            "reason": "Invalid element",
          },
          {
            "context": {
              "code": "invalid_value",
              "input": "value2",
              "values": [
                "value1",
              ],
            },
            "name": "path[0][to][9][field]",
            "reason": "Invalid value",
          },
          {
            "context": {
              "code": "custom",
              "input": "data",
              "params": {
                "key": "value",
              },
            },
            "name": "path[to][field]",
            "reason": "Custom",
          },
        ]
      `);
    });
  });
});
