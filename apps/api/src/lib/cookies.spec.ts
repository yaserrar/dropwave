import { readCookies } from './cookies.js';

describe('readCookies', () => {
  it('returns every value of the named cookie', () => {
    expect(
      readCookies(
        'a=1; dropwave_unlock=x.y; b=2; dropwave_unlock=z',
        'dropwave_unlock',
      ),
    ).toEqual(['x.y', 'z']);
  });

  it('decodes values and ignores other or malformed cookies', () => {
    expect(readCookies('t=a%2Bb; tt=no; bare; t=%E0%A4%A', 't')).toEqual([
      'a+b',
    ]);
  });

  it('handles a missing header', () => {
    expect(readCookies(undefined, 't')).toEqual([]);
    expect(readCookies('', 't')).toEqual([]);
  });
});
