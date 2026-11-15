import { readFileSync } from 'node:fs';
import { strToU8 } from 'fflate';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cleControle, codeInterne, normaliserCode, symbologie } from '../../src/lib/codes-barres.ts';
import { codeEnImage } from '../../src/lib/etiquettes.ts';
import { analyserMontant, analyserQuantite, montantPourSaisie, nomLocal } from '../../src/lib/formats.ts';
import { analyserTableau } from '../../src/lib/import-produits.ts';
import { preparerPhoto } from '../../src/lib/photos.ts';
import { etatProduit, etatVariante } from '../../src/lib/stock.ts';
import { ecrireXlsx, lireCsv, lireTableur, lireXlsx, TableurIllisible } from '../../src/lib/tableur.ts';

describe('codes-barres', () => {
  it('calcule la clé de contrôle des codes EAN et UPC', () => {
    expect(cleControle('613000000001')).toBe(5);
    expect(cleControle('301762042200')).toBe(3);
    expect(cleControle('9638507')).toBe(4); // EAN-8
    expect(cleControle('03600029145')).toBe(2); // UPC-A
  });
  it('nettoie la saisie et ramène un UPC-A à la forme EAN-13', () => {
    expect(normaliserCode(' 6130 0000 00015 ')).toBe('6130000000015');
    expect(normaliserCode('٦١٣٠٠٠٠٠٠٠٠١٥')).toBe('6130000000015');
    expect(normaliserCode('036000291452')).toBe('0036000291452');
    expect(normaliserCode('123456789013')).toBe('123456789013'); // 12 chiffres sans clé juste : laissé tel quel
    expect(normaliserCode('REF-42/A')).toBe('REF-42/A');
    expect(normaliserCode('')).toBeNull();
    expect(normaliserCode('café')).toBeNull();
    expect(normaliserCode('x'.repeat(65))).toBeNull();
  });
  it('choisit le type de code à imprimer', () => {
    expect(symbologie('6130000000015')).toBe('ean13');
    expect(symbologie('6130000000010')).toBe('code128'); // clé fausse : pas un EAN
    expect(symbologie('96385074')).toBe('ean8');
    expect(symbologie('TS-M')).toBe('code128');
  });
  it('crée des codes internes valides, dans la plage réservée aux magasins', () => {
    const codes = new Set(Array.from({ length: 200 }, () => codeInterne()));
    expect(codes.size).toBe(200);
    for (const c of codes) {
      expect(c).toMatch(/^2\d{12}$/);
      expect(symbologie(c)).toBe('ean13');
    }
  });
  it('dessine un code-barres et un QR code', () => {
    for (const image of [codeEnImage('6130000000015', 'barres'), codeEnImage('TS-M', 'barres'), codeEnImage('TS-M', 'qr')]) {
      expect(image.startsWith('data:image/svg+xml;base64,')).toBe(true);
      expect(Buffer.from(image.split(',')[1]!, 'base64').toString()).toContain('<svg');
    }
  });
});

describe('saisie des montants et des quantités', () => {
  it('lit un montant en dinars et le rend en centimes', () => {
    expect(analyserMontant('1250')).toBe(125_000);
    expect(analyserMontant('1 250')).toBe(125_000);
    expect(analyserMontant('1 250,50 DA')).toBe(125_050);
    expect(analyserMontant('1250.5')).toBe(125_050);
    expect(analyserMontant('٢٥٠')).toBe(25_000);
    expect(analyserMontant('0')).toBe(0);
    for (const faux of ['', 'abc', '-5', '12,345', '1.2.3', '99999999999']) expect(analyserMontant(faux), faux).toBeNull();
  });
  it('lit une quantité entière', () => {
    expect(analyserQuantite('12')).toBe(12);
    expect(analyserQuantite('1 000')).toBe(1000);
    for (const faux of ['', '1,5', '-1', 'x', '10000000']) expect(analyserQuantite(faux), faux).toBeNull();
  });
  it('réécrit un montant pour un champ de saisie, et choisit le nom selon la langue', () => {
    expect(montantPourSaisie(125_000)).toBe('1250');
    expect(montantPourSaisie('125050')).toBe('1250,50');
    expect(analyserMontant(montantPourSaisie(125_005))).toBe(125_005);
    expect(nomLocal({ nom_fr: 'Café', nom_ar: 'قهوة' }, 'ar')).toBe('قهوة');
    expect(nomLocal({ nom_fr: 'Café', nom_ar: '' }, 'ar')).toBe('Café');
    expect(nomLocal({ nom_fr: '', nom_ar: 'قهوة' }, 'fr')).toBe('قهوة');
  });
});

describe('état du stock', () => {
  it('rupture à zéro, bas au seuil, sans alerte quand le seuil est à zéro', () => {
    expect(etatVariante(0, 0)).toBe('rupture');
    expect(etatVariante(5, 5)).toBe('bas');
    expect(etatVariante(6, 5)).toBe('ok');
    expect(etatVariante(1, 0)).toBe('ok');
    expect(etatProduit({ stock: 4, nb_rupture: 1, nb_bas: 0 })).toBe('bas');
    expect(etatProduit({ stock: 0, nb_rupture: 2, nb_bas: 0 })).toBe('rupture');
    expect(etatProduit({ stock: 9, nb_rupture: 0, nb_bas: 0 })).toBe('ok');
  });
});

describe('lecture d\'un fichier Excel ou CSV', () => {
  const fichier = new Uint8Array(readFileSync('tests/fixtures/produits.xlsx'));

  it('lit un vrai fichier .xlsx : texte, arabe, nombres, cellules vides, caractères spéciaux', () => {
    const lignes = lireTableur(fichier);
    expect(lignes[0]).toEqual(['Nom du produit', 'Nom arabe', 'Variante', 'Catégorie', 'Code-barres', "Prix d'achat (DA)", 'Prix de vente (DA)', 'Quantité', "Seuil d'alerte"]);
    expect(lignes[1]).toEqual(['Café moulu 250 g', 'قهوة مطحونة', '', 'Épicerie', '6130000000015', '180', '250', '24', '6']);
    expect(lignes[2]!.slice(0, 6)).toEqual(['T-shirt & co <uni>', 'قميص', 'M', 'Vêtements', 'TS-M', '500.5']);
    expect(lignes[4]!.every((c) => !c)).toBe(true);
    expect(lignes).toHaveLength(8);
  });

  it('transforme le tableau en fiches : variantes regroupées, lignes fausses signalées avec leur numéro', () => {
    const a = analyserTableau(lireTableur(fichier));
    expect(a.manquantes).toEqual([]);
    expect(a.reconnues).toHaveLength(9);
    expect(a.groupes.map((g) => [g.nomFr, g.lignes, g.variantes.length])).toEqual([['Café moulu 250 g', [2], 1], ['T-shirt & co <uni>', [3, 4], 2], ['Savon', [6], 1]]);
    expect(a.groupes[0]).toMatchObject({ nomAr: 'قهوة مطحونة', categorie: 'Épicerie' });
    expect(a.groupes[0]!.variantes[0]).toEqual({ libelle: '', codeBarres: '6130000000015', prixAchat: 18_000, prixVente: 25_000, seuil: 6, stockInitial: 24 });
    expect(a.groupes[1]!.variantes.map((v) => [v.libelle, v.prixAchat, v.prixVente])).toEqual([['M', 50_050, 90_000], ['L', 50_050, 95_000]]);
    expect(a.groupes[2]!.variantes[0]).toMatchObject({ prixVente: 120_000, prixAchat: 0, stockInitial: 0, codeBarres: null });
    expect(a.erreurs).toEqual([{ ligne: 7, raison: 'nom_requis' }, { ligne: 8, raison: 'montant_invalide' }]);
  });

  it('reconnaît les titres en arabe, signale les colonnes obligatoires absentes et les doublons', () => {
    const arabe = analyserTableau([['المنتج', 'سعر البيع', 'الكمية'], ['قهوة', '250', '4']]);
    expect(arabe.groupes[0]).toMatchObject({ nomFr: '', nomAr: 'قهوة' });
    expect(arabe.groupes[0]!.variantes[0]).toMatchObject({ prixVente: 25_000, stockInitial: 4 });
    const uneColonne = analyserTableau([['Produit', 'Prix'], ['قهوة', '250']]);
    expect(uneColonne.groupes[0]).toMatchObject({ nomFr: '', nomAr: 'قهوة' });
    expect(analyserTableau([['Produit', 'Stock'], ['Café', '4']]).manquantes).toEqual(['prixVente']);
    expect(analyserTableau([['Prix'], ['4']]).manquantes).toEqual(['nom']);
    expect(analyserTableau([]).manquantes).toEqual(['nom', 'prixVente']);
    const doublons = analyserTableau([['Nom', 'Prix', 'Code'], ['A', '1', 'X1'], ['B', '2', 'X1'], ['C', '3', ''], ['C', '4', '']]);
    expect(doublons.groupes.map((g) => g.nomFr)).toEqual(['A']);
    expect(doublons.erreurs).toEqual([{ ligne: 3, raison: 'code_barres_double' }, { ligne: 4, raison: 'variante_libelle' }, { ligne: 5, raison: 'variante_libelle' }]);
  });

  it('lit un CSV avec point-virgule, guillemets et ancien codage Windows', () => {
    const csv = '﻿Nom;Prix\r\n"Thé; vert ""bio""";1 200\r\n\r\nSel;40\r\n';
    expect(lireCsv(strToU8(csv))).toEqual([['Nom', 'Prix'], ['Thé; vert "bio"', '1 200'], [''], ['Sel', '40']]);
    expect(lireCsv(strToU8('a,b\n1,2'))).toEqual([['a', 'b'], ['1', '2']]);
    // « Café » puis « قهوة » en Windows-1256.
    expect(lireCsv(new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x3b, 0xde, 0xe5, 0xe6, 0xc9]))).toEqual([['Café', 'قهوة']]);
  });

  it('écrit un classeur que le lecteur relit à l\'identique', () => {
    const lignes = [['Nom', 'Prix <DA> & "taxes"', 'قهوة'], ['Café', 250, ''], ['', 1250.5, 'x']];
    const relu = lireXlsx(ecrireXlsx(lignes, { droiteAGauche: true, largeurs: [20, 10, 10] }));
    expect(relu).toEqual([['Nom', 'Prix <DA> & "taxes"', 'قهوة'], ['Café', '250'], ['', '1250.5', 'x']]);
  });

  it('refuse un fichier illisible ou trop long, sans planter', () => {
    expect(() => lireTableur(new Uint8Array([0x50, 0x4b, 1, 2, 3]))).toThrow(TableurIllisible);
    expect(() => lireXlsx(ecrireXlsx([]).slice(0, 40))).toThrow(TableurIllisible);
    expect(() => lireCsv(strToU8('a\n'.repeat(2100)))).toThrow(/trop_de_lignes/);
    expect(() => lireXlsx(ecrireXlsx(Array.from({ length: 2100 }, (_, i) => [i])))).toThrow(/trop_de_lignes/);
  });
});

describe('photos', () => {
  it('réécrit une vraie image en WebP réduit, sans ses métadonnées', async () => {
    const source = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#0e6b4e' } })
      .withExif({ IFD0: { Copyright: 'secret', Make: 'Appareil' } }).jpeg().toBuffer();
    const r = (await preparerPhoto(source))!;
    const grande = await sharp(r.grande).metadata();
    expect([grande.format, grande.width, grande.height]).toEqual(['webp', 1200, 800]);
    expect(grande.exif).toBeUndefined();
    expect(r.grande.includes('secret')).toBe(false);
    const petite = await sharp(r.petite).metadata();
    expect([petite.format, petite.width, petite.height]).toEqual(['webp', 192, 192]);
  });
  it('refuse ce qui n\'est pas une image, même avec une fausse extension', async () => {
    expect(await preparerPhoto(strToU8('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(await preparerPhoto(strToU8('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(await preparerPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]))).toBeNull();
    expect(await preparerPhoto(new Uint8Array(0))).toBeNull();
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).gif().toBuffer();
    expect(await preparerPhoto(gif)).toBeNull();
  });
});
