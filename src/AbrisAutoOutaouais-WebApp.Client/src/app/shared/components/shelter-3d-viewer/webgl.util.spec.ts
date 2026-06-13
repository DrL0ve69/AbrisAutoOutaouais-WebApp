import { describe, it, expect } from 'vitest';
import { isWebglAvailable } from './webgl.util';

/** Fabrique un faux Document dont le canvas renvoie le contexte demandé. */
function fakeDocument(getContextResult: unknown): Document {
  return {
    createElement: () => ({
      getContext: () => getContextResult,
    }),
  } as unknown as Document;
}

describe('isWebglAvailable', () => {
  it('renvoie true quand un contexte WebGL est obtenu', () => {
    expect(isWebglAvailable(fakeDocument({}))).toBe(true);
  });

  it('renvoie false quand getContext renvoie null (pas de WebGL)', () => {
    expect(isWebglAvailable(fakeDocument(null))).toBe(false);
  });

  it('renvoie false sans document (SSR)', () => {
    expect(isWebglAvailable(undefined)).toBe(false);
  });

  it('renvoie false si la création du contexte lève (GPU blacklisté)', () => {
    const doc = {
      createElement: () => ({
        getContext: () => {
          throw new Error('SecurityError');
        },
      }),
    } as unknown as Document;
    expect(isWebglAvailable(doc)).toBe(false);
  });
});
