import { describe, expect, it } from 'bun:test';
import { splitName } from '../src/frontend/lib/name-utils';

describe('splitName', () => {
  it('returns empty last for a single-word name', () => {
    expect(splitName('Alice')).toEqual({ first: 'Alice', last: '' });
  });

  it('splits two-word name into first and last', () => {
    expect(splitName('Alice Kim')).toEqual({ first: 'Alice', last: 'Kim' });
  });

  it('treats everything after the first word as last name', () => {
    expect(splitName('Mary Jane Kim')).toEqual({ first: 'Mary', last: 'Jane Kim' });
  });

  it('handles four-part names', () => {
    expect(splitName('José Luis García López')).toEqual({ first: 'José', last: 'Luis García López' });
  });

  it('trims leading and trailing whitespace', () => {
    expect(splitName('  Bob Smith  ')).toEqual({ first: 'Bob', last: 'Smith' });
  });

  it('returns empty strings for empty input', () => {
    expect(splitName('')).toEqual({ first: '', last: '' });
  });

  it('handles null/undefined gracefully', () => {
    expect(splitName(null as unknown as string)).toEqual({ first: '', last: '' });
  });
});
