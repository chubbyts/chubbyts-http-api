import type { Decoder } from '@chubbyts/chubbyts-decode-encode/dist/decoder';
import { DecodeError } from '@chubbyts/chubbyts-decode-encode/dist/decoder';
import { describe, expect, test } from 'vitest';
import { useObjectMock } from '@chubbyts/chubbyts-function-mock/dist/object-mock';
import { parseRequestBody } from '../src/request.js';
import { createServerRequest } from './http.js';

describe('request', () => {
  describe('parseRequestBody', () => {
    test('without given content type attribute', async () => {
      const serverRequest = createServerRequest('https://example.com/');

      const [decoder, decoderMocks] = useObjectMock<Decoder>([]);

      try {
        await parseRequestBody(decoder, serverRequest);
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toMatchInlineSnapshot(
          '[Error: Use createContentTypeNegotiationMiddleware to assign request.attributes.contentType.]',
        );
      }

      expect(decoderMocks).toHaveLength(0);
    });

    test('with given content type attribute', async () => {
      const data = { key: 'value' };
      const encodedData = JSON.stringify(data);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        headers: { 'content-type': 'application/json' },
        body: encodedData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedData, 'application/json', { serverRequest }], return: data },
      ]);

      expect(await parseRequestBody(decoder, serverRequest)).toBe(data);

      expect(decoderMocks).toHaveLength(0);
    });

    test('with given content type attribute, but with decode error', async () => {
      const error = new DecodeError('something went wrong');

      const data = { key: 'value' };
      const encodedData = JSON.stringify(data);

      const serverRequest = createServerRequest('https://example.com/', {
        method: 'POST',
        attributes: { contentType: 'application/json' },
        headers: { 'content-type': 'application/json' },
        body: encodedData,
      });

      const [decoder, decoderMocks] = useObjectMock<Decoder>([
        { name: 'decode', parameters: [encodedData, 'application/json', { serverRequest }], error },
      ]);

      try {
        await parseRequestBody(decoder, serverRequest);
        throw new Error('Expect Error');
      } catch (e) {
        expect(e).toBe(error);
      }

      expect(decoderMocks).toHaveLength(0);
    });
  });
});
