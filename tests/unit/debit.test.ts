// Limite de débit en mémoire du proxy (contre la saturation des pages publiques).
import { describe, expect, it } from 'vitest';
import { autoriserMemoire, viderCompteursMemoire } from '../../src/lib/debit-memoire.ts';

describe('limite de débit en mémoire', () => {
  it('arrête une adresse au-delà du maximum, sans gêner les autres, et repart après la fenêtre', () => {
    viderCompteursMemoire();
    const t = 1_000_000;
    for (let i = 0; i < 300; i++) expect(autoriserMemoire('pages:1.2.3.4', 300, 60_000, t)).toBe(true);
    expect(autoriserMemoire('pages:1.2.3.4', 300, 60_000, t + 10)).toBe(false);
    expect(autoriserMemoire('pages:5.6.7.8', 300, 60_000, t + 10)).toBe(true);
    expect(autoriserMemoire('pages:1.2.3.4', 300, 60_000, t + 60_000)).toBe(true);
  });
});
