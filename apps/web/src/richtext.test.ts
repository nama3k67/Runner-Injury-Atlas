import { describe, expect, it } from 'vitest';
import { paragraphs, tokenize } from './richtext';

describe('tokenize', () => {
  it('splits bold, italic and source references', () => {
    expect(tokenize('Dải **neo chặt** vào *xương đùi*[^r1][^r12].')).toEqual([
      { type: 'text', text: 'Dải ' },
      { type: 'bold', text: 'neo chặt' },
      { type: 'text', text: ' vào ' },
      { type: 'italic', text: 'xương đùi' },
      { type: 'source', id: 'r1' },
      { type: 'source', id: 'r12' },
      { type: 'text', text: '.' },
    ]);
  });
  it('returns plain text untouched', () => {
    expect(tokenize('Không có gì đặc biệt')).toEqual([
      { type: 'text', text: 'Không có gì đặc biệt' },
    ]);
  });
});

describe('paragraphs', () => {
  it('splits on blank lines', () => {
    expect(paragraphs('a\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
  });
});
