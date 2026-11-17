import { describe, expect, it } from 'vitest';
import { analyserTaux, calculerLigne, calculerTimbre, formaterTaux, lireBaremeTimbre, lireReglagesDocuments, prixHorsTaxe } from '../../src/lib/fiscal.ts';
import { montantEnLettres, nombreEnLettresAr, nombreEnLettresFr } from '../../src/lib/montant-lettres.ts';

describe('montant en toutes lettres', () => {
  it('écrit les nombres en français avec leurs règles (et, traits d\'union, cent, vingt, mille)', () => {
    const cas: [number, string][] = [
      [0, 'zéro'], [1, 'un'], [16, 'seize'], [17, 'dix-sept'], [21, 'vingt et un'], [22, 'vingt-deux'], [70, 'soixante-dix'], [71, 'soixante et onze'],
      [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [90, 'quatre-vingt-dix'], [91, 'quatre-vingt-onze'], [99, 'quatre-vingt-dix-neuf'],
      [100, 'cent'], [101, 'cent un'], [200, 'deux cents'], [201, 'deux cent un'], [1000, 'mille'], [1001, 'mille un'], [2000, 'deux mille'],
      [80_000, 'quatre-vingt mille'], [200_000, 'deux cent mille'], [12_500, 'douze mille cinq cents'], [1_000_000, 'un million'],
      [2_300_480, 'deux millions trois cent mille quatre cent quatre-vingts'], [1_000_000_000, 'un milliard'],
    ];
    for (const [n, texte] of cas) expect(nombreEnLettresFr(n), String(n)).toBe(texte);
  });
  it('écrit les nombres en arabe (duel, pluriel de 3 à 10, liaison par « و »)', () => {
    const cas: [number, string][] = [
      [0, 'صفر'], [1, 'واحد'], [2, 'اثنان'], [11, 'أحد عشر'], [15, 'خمسة عشر'], [20, 'عشرون'], [25, 'خمسة وعشرون'], [100, 'مائة'], [200, 'مائتان'],
      [345, 'ثلاثمائة وخمسة وأربعون'], [1000, 'ألف'], [2000, 'ألفان'], [3000, 'ثلاثة آلاف'], [10_000, 'عشرة آلاف'], [11_000, 'أحد عشر ألف'],
      [12_500, 'اثنا عشر ألف وخمسمائة'], [1_000_000, 'مليون'], [2_000_000, 'مليونان'], [5_250_000, 'خمسة ملايين ومائتان وخمسون ألف'],
    ];
    for (const [n, texte] of cas) expect(nombreEnLettresAr(n), String(n)).toBe(texte);
  });
  it('écrit un montant complet, avec les centimes et le signe', () => {
    expect(montantEnLettres(1_250_000, 'fr')).toBe('Douze mille cinq cents dinars');
    expect(montantEnLettres(1_250_050, 'fr')).toBe('Douze mille cinq cents dinars et cinquante centimes');
    expect(montantEnLettres(100, 'fr')).toBe('Un dinar');
    expect(montantEnLettres(101, 'fr')).toBe('Un dinar et un centime');
    expect(montantEnLettres(-7_500_000, 'fr')).toBe('Moins soixante-quinze mille dinars');
    expect(montantEnLettres(1_250_000, 'ar')).toBe('اثنا عشر ألف وخمسمائة دينار جزائري');
    expect(montantEnLettres(450_050, 'ar')).toBe('أربعة آلاف وخمسمائة دينار جزائري وخمسون سنتيم');
    expect(montantEnLettres(-100, 'ar')).toBe('ناقص واحد دينار جزائري');
  });
});

describe('TVA', () => {
  it('déduit le hors taxe du prix TTC, ligne par ligne, sans jamais perdre un centime', () => {
    expect(calculerLigne(119_000, 2, 1900)).toEqual({ totalTtc: 238_000, totalHt: 200_000 });
    expect(calculerLigne(10_900, 1, 900)).toEqual({ totalTtc: 10_900, totalHt: 10_000 });
    expect(calculerLigne(25_000, 3, 0)).toEqual({ totalTtc: 75_000, totalHt: 75_000 });
    const l = calculerLigne(9_999, 7, 1900); // arrondi : HT + TVA = TTC, toujours
    expect(Number.isInteger(l.totalHt)).toBe(true);
    expect(l.totalHt + (l.totalTtc - l.totalHt)).toBe(69_993);
    expect(prixHorsTaxe(119_000, 1900)).toBe(100_000);
    expect(prixHorsTaxe(119_000, 0)).toBe(119_000);
  });
  it('lit et écrit un taux', () => {
    expect(analyserTaux('19')).toBe(1900);
    expect(analyserTaux(' 9,5 % ')).toBe(950);
    expect(analyserTaux('0')).toBe(0);
    for (const faux of ['', 'abc', '-1', '101', '9,555']) expect(analyserTaux(faux), faux).toBeNull();
    expect(formaterTaux(1900)).toBe('19 %');
    expect(formaterTaux(950)).toBe('9,5 %');
  });
  it('part de réglages vides : aucune taxe n\'est supposée', () => {
    expect(lireReglagesDocuments(null)).toMatchObject({ assujettiTva: false, tauxDefaut: 0, timbreFactures: false, timbreTickets: false, validiteDevisJours: 30 });
    expect(lireReglagesDocuments({ assujettiTva: 'oui' }).assujettiTva).toBe(false); // réglage illisible : retour aux valeurs sûres
  });
});

describe('droit de timbre', () => {
  const bareme = lireBaremeTimbre({ exonereJusqua: 30_000, tranches: [{ jusqua: 3_000_000, parCent: 100 }, { jusqua: 10_000_000, parCent: 150 }, { jusqua: null, parCent: 200 }], minimum: 500, plafond: 1_000_000 });
  it('vaut zéro tant que l\'administrateur n\'a pas saisi de barème', () => {
    expect(calculerTimbre(5_000_000, lireBaremeTimbre(undefined))).toBe(0);
    expect(calculerTimbre(5_000_000, lireBaremeTimbre({ tranches: 'faux' }))).toBe(0);
  });
  it('applique l\'exonération, la tranche, le minimum et le plafond du barème saisi', () => {
    expect(calculerTimbre(30_000, bareme)).toBe(0); // exonéré
    expect(calculerTimbre(30_100, bareme)).toBe(500); // 4 tranches × 1 DA = 4 DA, relevé au minimum de 5 DA
    expect(calculerTimbre(248_900, bareme)).toBe(2_500); // 25 tranches de 100 DA commencées
    expect(calculerTimbre(5_000_000, bareme)).toBe(75_000); // 500 × 1,5 DA
    expect(calculerTimbre(20_000_000, bareme)).toBe(400_000); // 2 000 × 2 DA
    expect(calculerTimbre(900_000_000, bareme)).toBe(1_000_000); // plafond
    expect(calculerTimbre(0, bareme)).toBe(0);
    expect(calculerTimbre(-5_000, bareme)).toBe(0);
  });
});
