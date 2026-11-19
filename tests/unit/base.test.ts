import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chiffrer, cleAncienne, dechiffrer, empreinte, nouveauJeton } from '../../src/lib/chiffrement.ts';
import { config } from '../../src/lib/config.ts';
import { DROIT_MODULE, peut } from '../../src/lib/droits.ts';
import { formaterDate, formaterMontant, formaterTelephone, normaliserTelephone } from '../../src/lib/formats.ts';
import { tronquerIp } from '../../src/lib/journal.ts';
import { aRehacher, defautMotDePasse, hacher, verifier } from '../../src/lib/mots-de-passe.ts';
import { codeTotpActuel, codeTotpValide, nouveauSecretTotp } from '../../src/lib/totp.ts';

describe('chiffrement champ par champ', () => {
  it('chiffre et déchiffre, avec un résultat différent à chaque fois', () => {
    const a = chiffrer('0550123456', 'clients.telephone:1');
    const b = chiffrer('0550123456', 'clients.telephone:1');
    expect(a).not.toBe(b);
    expect(a).not.toContain('0550123456');
    expect(dechiffrer(a, 'clients.telephone:1')).toBe('0550123456');
  });
  it('refuse une valeur déplacée vers une autre ligne ou modifiée', () => {
    const a = chiffrer('secret', 'commercants.nif:1');
    expect(() => dechiffrer(a, 'commercants.nif:2')).toThrow();
    // Un caractère changé au milieu (la fin peut ne porter que des bits de remplissage ignorés au décodage).
    const m = Math.floor(a.length / 2);
    expect(() => dechiffrer(a.slice(0, m) + (a[m] === 'A' ? 'B' : 'A') + a.slice(m + 1), 'commercants.nif:1')).toThrow();
  });
  it('lit encore les valeurs chiffrées avec une ancienne clé après un renouvellement', () => {
    const c = config();
    const active = c.CLE_CHIFFREMENT_ACTIVE;
    c.CLE_CHIFFREMENT_ACTIVE = '1';
    const ancienne = chiffrer('avant renouvellement', 'x');
    c.CLE_CHIFFREMENT_ACTIVE = active;
    expect(dechiffrer(ancienne, 'x')).toBe('avant renouvellement');
    expect(cleAncienne(ancienne)).toBe(true);
    expect(cleAncienne(chiffrer('après', 'x'))).toBe(false);
  });
  it('produit des empreintes stables et des jetons uniques', () => {
    expect(empreinte('0550123456', 'tel')).toBe(empreinte('0550123456', 'tel'));
    expect(empreinte('0550123456', 'tel')).not.toBe(empreinte('0550123456', 'autre'));
    const j = nouveauJeton();
    expect(j.jeton.length).toBeGreaterThanOrEqual(43);
    expect(j.hash).not.toContain(j.jeton);
  });
});

describe('mots de passe', () => {
  it('hache en Argon2id et vérifie', async () => {
    const h = await hacher('correct cheval pile agrafe');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifier(h, 'correct cheval pile agrafe')).toBe(true);
    expect(await verifier(h, 'autre')).toBe(false);
    expect(aRehacher(h)).toBe(false);
    expect(aRehacher('$argon2id$v=19$m=4096,t=1,p=1$abc$def')).toBe(true);
  });
  it('applique la longueur et refuse les mots de passe courants, sans règle de composition', () => {
    expect(defautMotDePasse('court', 8)).toBe('mdp_trop_court');
    expect(defautMotDePasse('azerty123', 8)).toBe('mdp_trop_courant');
    expect(defautMotDePasse('AZERTY123', 8)).toBe('mdp_trop_courant');
    expect(defautMotDePasse('aaaaaaaaaaaaaaaaaaaa', 15)).toBe('mdp_trop_courant');
    expect(defautMotDePasse('0550123456', 8, ['Ali', '0550123456'])).toBe('mdp_trop_courant');
    expect(defautMotDePasse('x'.repeat(200) + 'y', 8)).toBe('mdp_trop_long');
    expect(defautMotDePasse('tout en minuscules sans chiffre', 15)).toBeNull();
    expect(defautMotDePasse('كلمة سر طويلة جدا', 15)).toBeNull();
  });
});

describe('double authentification', () => {
  it('accepte le code courant et refuse les autres', () => {
    const s = nouveauSecretTotp();
    expect(codeTotpValide(s, codeTotpActuel(s))).toBe(true);
    expect(codeTotpValide(s, '12345')).toBe(false);
    expect(codeTotpValide(s, 'abcdef')).toBe(false);
  });
});

describe('formats', () => {
  it('écrit les montants en dinars avec des espaces insécables', () => {
    expect(formaterMontant(1_250_000, 'fr')).toBe('12 500 DA');
    expect(formaterMontant(1_250_000, 'ar')).toBe('\u206612 500\u2069 د.ج'); // nombre isolé : jamais affiché à l'envers
    expect(formaterMontant(150, 'fr')).toBe('1,50 DA');
    expect(formaterMontant(0, 'fr')).toBe('0 DA');
    expect(formaterMontant(-99_900, 'fr')).toBe('-999 DA');
    expect(formaterMontant(123_456_789_00n, 'fr')).toBe('123 456 789 DA');
  });
  it('écrit les dates en JJ/MM/AAAA à l\'heure d\'Alger', () => {
    expect(formaterDate(new Date('2026-11-15T23:30:00Z'))).toBe('16/11/2026');
    expect(formaterDate(new Date('2026-01-05T10:00:00Z'))).toBe('05/01/2026');
  });
  it('normalise les téléphones algériens à 10 chiffres', () => {
    expect(normaliserTelephone('0550 12 34 56')).toBe('0550123456');
    expect(normaliserTelephone('+213 550 12 34 56')).toBe('0550123456');
    expect(normaliserTelephone('00213550123456')).toBe('0550123456');
    expect(normaliserTelephone('٠٥٥٠١٢٣٤٥٦')).toBe('0550123456');
    expect(normaliserTelephone('550123456')).toBeNull();
    expect(normaliserTelephone('05501234567')).toBeNull();
    expect(normaliserTelephone('abc')).toBeNull();
    expect(formaterTelephone('0550123456')).toBe('0550 12 34 56');
  });
  it('tronque les adresses internet', () => {
    expect(tronquerIp('41.100.12.77')).toBe('41.100.12.0');
    expect(tronquerIp('::ffff:41.100.12.77')).toBe('41.100.12.0');
    expect(tronquerIp('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::');
    expect(tronquerIp(null)).toBeNull();
  });
});

describe('droits des rôles', () => {
  it('réserve les réglages, l\'équipe et les rapports au propriétaire', () => {
    for (const d of ['reglages', 'equipe', 'rapports', 'stock.corriger'] as const) {
      expect(peut('proprietaire', d)).toBe(true);
      expect(peut('vendeur', d)).toBe(false);
      expect(peut('preparateur', d)).toBe(false);
    }
    expect(peut('vendeur', 'vendre')).toBe(true);
    expect(peut('preparateur', 'vendre')).toBe(false);
    expect(peut('preparateur', 'preparer')).toBe(true);
    expect(DROIT_MODULE.caisse).toBe('vendre');
  });
});

describe('traductions', () => {
  const cles = (o: object, p = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
  const fr = JSON.parse(readFileSync('messages/fr.json', 'utf8'));
  const ar = JSON.parse(readFileSync('messages/ar.json', 'utf8'));
  it('ont exactement les mêmes clés en français et en arabe', () => {
    expect(cles(ar).sort()).toEqual(cles(fr).sort());
  });
  it('n\'ont aucun texte vide, et l\'arabe est bien écrit en arabe', () => {
    const valeurs = (o: object): string[] => Object.values(o).flatMap((v) => (typeof v === 'object' ? valeurs(v) : [String(v)]));
    expect(valeurs(fr).every((v) => v.trim().length > 0)).toBe(true);
    const sansArabe = valeurs(ar).filter((v) => !/[؀-ۿ]/.test(v));
    expect(sansArabe).toEqual([]);
  });
});
