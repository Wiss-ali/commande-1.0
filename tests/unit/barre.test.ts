// Barre du bas : 4 entrées choisies parmi celles que la personne peut ouvrir.
import { describe, expect, it } from 'vitest';
import { barreDe, entreesDisponibles } from '../../src/lib/barre.ts';
import type { Modules } from '../../src/lib/types-bd.ts';

const tous: Modules = { stock: true, caisse: true, factures: true, commandes: true, clients: true, rapports: true, boutique: true };

describe('barre du bas', () => {
  it('par défaut : Accueil, Caisse, Scan, Stock', () => {
    expect(barreDe(null, entreesDisponibles('proprietaire', tous))).toEqual(['accueil', 'caisse', 'scan', 'stock']);
  });

  it('sans caisse (vendeur sur Instagram), la place va aux Commandes', () => {
    expect(barreDe(null, entreesDisponibles('proprietaire', { ...tous, caisse: false }))).toEqual(['accueil', 'scan', 'stock', 'commandes']);
  });

  it('le préparateur ne voit que ce qu\'il peut ouvrir', () => {
    expect(entreesDisponibles('preparateur', tous)).toEqual(['accueil', 'scan', 'stock', 'commandes']);
  });

  it('garde le choix de la personne, sans doublon, et complète une entrée qui n\'est plus ouverte', () => {
    const d = entreesDisponibles('proprietaire', tous);
    expect(barreDe(['commandes', 'factures', 'commandes', 'scan'], d)).toEqual(['commandes', 'factures', 'scan', 'accueil']);
    expect(barreDe(['factures', 'clients'], d)).toEqual(['factures', 'clients']);
    // Module retiré par l'abonnement : la place est reprise par défaut.
    expect(barreDe(['rapports', 'factures', 'caisse', 'stock'], entreesDisponibles('proprietaire', { ...tous, rapports: false }))).toEqual(['factures', 'caisse', 'stock', 'accueil']);
    expect(barreDe(['inconnu'], d)).toEqual(['accueil']);
  });
});
