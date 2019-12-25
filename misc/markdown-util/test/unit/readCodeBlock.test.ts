/* eslint-disable @typescript-eslint/camelcase */
import mock from 'rewiremock';
import { stub } from 'sinon';

mock.enable();
mock('mz/fs').with({
  readFile: async () => 'test',
});
mock('js-yaml').with({
  safeLoad: stub().returns({
    TypeScript: {
      type: 'programming',
      color: '#2b7489',
      aliases: ['ts'],
      interpreters: ['node'],
      extensions: ['.ts', '.tsx'],
      tm_scope: 'source.ts',
      ace_mode: 'typescript',
      codemirror_mode: 'javascript',
      codemirror_mime_type: 'application/typescript',
      language_id: 378,
    },
  }),
});
const { readCodeBlock } = require('../../src');
mock.disable();

describe('readCodeBlock', () => {
  it('typescript', async () => {
    expect(await readCodeBlock('something.ts')).toBe('```typescript\ntest\n```\n');

    expect(await readCodeBlock('something.tsx')).toBe('```typescript\ntest\n```\n');

    expect(await readCodeBlock('something.js')).toBe('```\ntest\n```\n');

    expect(await readCodeBlock('something')).toBe('```\ntest\n```\n');
  });
});
