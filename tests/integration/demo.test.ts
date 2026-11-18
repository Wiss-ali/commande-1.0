// Boutique de démonstration de l'administrateur : remplie, jamais comptée, remise à zéro à la demande.
import { afterAll, describe, expect, it } from 'vitest';
import { tableauAbonnements } from '../../src/lib/abonnements.ts';
import { avecCommercant, bd, fermerBD } from '../../src/lib/bd.ts';
import { assurerDemo, demoActive, remettreDemo, SOUS_DOMAINE_DEMO } from '../../src/lib/demo.ts';
import { clientsQuiDoivent } from '../../src/lib/documents.ts';
import { creerSession, trouverSession } from '../../src/lib/sessions.ts';
import { creerAdmin } from '../outils.ts';

afterAll(fermerBD);

describe('boutique de démonstration', () => {
  it('est créée remplie, une seule fois, et n\'est jamais comptée dans les abonnements', async () => {
    const admin = await creerAdmin();
    const avant = await tableauAbonnements(bd('plateforme'));
    const d = await assurerDemo(admin.id);
    expect(await assurerDemo(admin.id)).toEqual(d);
    expect(await demoActive()).toEqual(d);
    expect(await tableauAbonnements(bd('plateforme'))).toEqual(avant);
    await avecCommercant(d.commercantId, async (trx) => {
      expect((await trx.selectFrom('produits').select('id').execute()).length).toBe(10);
      expect((await trx.selectFrom('documents').select('id').where('type', '=', 'ticket').execute()).length).toBeGreaterThanOrEqual(4);
      expect((await trx.selectFrom('commandes').select('statut').orderBy('numero').execute()).map((c) => c.statut)).toEqual(['a_confirmer', 'confirmee', 'livree']);
      expect((await clientsQuiDoivent(trx)).map((c) => c.nom)).toEqual(['Hadj Mokhtar']);
      expect((await trx.selectFrom('arrivages').select('id').execute()).length).toBe(1);
      const c = await trx.selectFrom('commercants').select(['sous_domaine', 'demo']).executeTakeFirstOrThrow();
      expect(c).toEqual({ sous_domaine: SOUS_DOMAINE_DEMO, demo: true });
    });
  });

  it('se remet à zéro : l\'ancienne est archivée (sessions fermées, adresse libérée), une neuve est créée', async () => {
    const admin = await creerAdmin();
    const ancienne = await assurerDemo(admin.id);
    const s = await creerSession(ancienne, { complete: true, appareil: 'test' });
    expect(await trouverSession(s.jeton)).toMatchObject({ commercant: { demo: true } });
    const neuve = await remettreDemo(admin.id);
    expect(neuve.commercantId).not.toBe(ancienne.commercantId);
    expect(await trouverSession(s.jeton)).toBeNull();
    const vieux = await bd('plateforme').selectFrom('commercants').select(['etat', 'sous_domaine']).where('id', '=', ancienne.commercantId).executeTakeFirstOrThrow();
    expect(vieux).toEqual({ etat: 'archive', sous_domaine: null });
    await avecCommercant(neuve.commercantId, async (trx) => {
      expect((await trx.selectFrom('commercants').select('sous_domaine').executeTakeFirstOrThrow()).sous_domaine).toBe(SOUS_DOMAINE_DEMO);
      expect((await trx.selectFrom('produits').select('id').execute()).length).toBe(10);
    });
  });
});
