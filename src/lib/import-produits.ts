// Import de produits depuis un tableau (Excel ou CSV). L'analyse est la même dans le navigateur
// (pour l'aperçu) et sur le serveur, qui ne fait confiance à rien de ce qu'il reçoit.
import type { Trx } from './bd.ts';
import { normaliserCode } from './codes-barres.ts';
import { analyserMontant, analyserQuantite } from './formats.ts';
import { creerProduit, trouverOuCreerCategorie, verifierProduit, type Contexte, type Refus, type SaisieVariante } from './stock.ts';

export const COLONNES = ['nom', 'nomAr', 'variante', 'categorie', 'codeBarres', 'prixAchat', 'prixVente', 'quantite', 'seuil'] as const;
export type Colonne = (typeof COLONNES)[number];

// Titres de colonnes reconnus, en français, en arabe et en anglais. Comparés sans accents ni majuscules.
const TITRES: Record<Colonne, string[]> = {
  nom: ['nom', 'nom du produit', 'produit', 'designation', 'article', 'libelle', 'name', 'الاسم بالفرنسية', 'الاسم'],
  nomAr: ['nom arabe', 'nom en arabe', 'nom ar', 'الاسم بالعربية', 'اسم المنتج', 'المنتج'],
  variante: ['variante', 'taille', 'couleur', 'taille / couleur', 'variant', 'النوع', 'المقاس', 'اللون', 'المقاس / اللون'],
  categorie: ['categorie', 'famille', 'rayon', 'category', 'الفئة', 'الصنف'],
  codeBarres: ['code-barres', 'code barres', 'code a barres', 'code barre', 'codebarre', 'code', 'ean', 'barcode', 'reference', 'ref', 'الباركود', 'الرمز'],
  prixAchat: ['prix d\'achat', 'prix achat', 'achat', 'cout', 'pa', 'سعر الشراء'],
  prixVente: ['prix de vente', 'prix vente', 'vente', 'prix', 'pv', 'price', 'سعر البيع', 'السعر'],
  quantite: ['quantite', 'qte', 'stock', 'quantity', 'qty', 'الكمية', 'المخزون'],
  seuil: ['seuil d\'alerte', 'seuil', 'alerte', 'stock minimum', 'stock min', 'حد التنبيه'],
};

// Les accents latins sont retirés, puis le texte est recomposé (NFC) : sans cela, certaines lettres arabes
// (« ئ » dans « الفئة ») resteraient décomposées et ne seraient plus reconnues.
const simplifier = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase().replace(/\(.*?\)/g, '').replace(/[’`]/g, "'").replace(/[_*:]/g, ' ').replace(/\s+/g, ' ').trim();

export interface GroupeImporte {
  /** Numéros des lignes du fichier (la première ligne porte le numéro 1). */
  lignes: number[];
  nomFr: string;
  nomAr: string;
  categorie: string;
  variantes: SaisieVariante[];
}
export interface ErreurImport {
  ligne: number;
  raison: Refus | 'deja_present';
}
export interface Analyse {
  /** Colonnes obligatoires absentes du fichier : rien n'est importable tant qu'il en manque. */
  manquantes: Colonne[];
  reconnues: Colonne[];
  groupes: GroupeImporte[];
  erreurs: ErreurImport[];
}

export function analyserTableau(lignes: string[][]): Analyse {
  const debut = lignes.findIndex((l) => l.some((c) => c.trim()));
  const titres = (lignes[debut] ?? []).map(simplifier);
  const index: Partial<Record<Colonne, number>> = {};
  for (const col of COLONNES) {
    const i = titres.findIndex((t, pos) => TITRES[col].includes(t) && !Object.values(index).includes(pos));
    if (i >= 0) index[col] = i;
  }
  const reconnues = COLONNES.filter((c) => index[c] !== undefined);
  const manquantes: Colonne[] = [];
  if (index.nom === undefined && index.nomAr === undefined) manquantes.push('nom');
  if (index.prixVente === undefined) manquantes.push('prixVente');
  if (manquantes.length) return { manquantes, reconnues, groupes: [], erreurs: [] };

  const erreurs: ErreurImport[] = [];
  const parNom = new Map<string, GroupeImporte>();
  for (let i = debut + 1; i < lignes.length; i++) {
    const l = lignes[i]!;
    const lire = (c: Colonne) => (index[c] === undefined ? '' : (l[index[c]!] ?? '').trim());
    if (!COLONNES.some((c) => lire(c))) continue; // ligne vide
    const ligne = i + 1;
    const refuser = (raison: Refus) => erreurs.push({ ligne, raison });
    let nomFr = lire('nom');
    let nomAr = lire('nomAr');
    // Une seule colonne de nom : un nom écrit en arabe va dans le nom arabe.
    if (nomFr && !nomAr && index.nomAr === undefined && /[؀-ۿ]/.test(nomFr)) [nomFr, nomAr] = ['', nomFr];
    if (!nomFr && !nomAr) { refuser('nom_requis'); continue; }
    const prixVente = analyserMontant(lire('prixVente'));
    const prixAchat = lire('prixAchat') ? analyserMontant(lire('prixAchat')) : 0;
    if (prixVente === null || prixAchat === null) { refuser('montant_invalide'); continue; }
    const quantite = lire('quantite') ? analyserQuantite(lire('quantite')) : 0;
    const seuil = lire('seuil') ? analyserQuantite(lire('seuil')) : 0;
    if (quantite === null || seuil === null) { refuser('quantite_invalide'); continue; }
    const code = lire('codeBarres');
    if (code && !normaliserCode(code)) { refuser('code_barres_invalide'); continue; }
    const variante: SaisieVariante = { libelle: lire('variante'), codeBarres: code || null, prixAchat, prixVente, seuil, stockInitial: quantite };
    const cle = (nomFr || nomAr).toLowerCase();
    const groupe = parNom.get(cle);
    if (groupe) {
      groupe.lignes.push(ligne);
      groupe.variantes.push(variante);
    } else {
      parNom.set(cle, { lignes: [ligne], nomFr, nomAr, categorie: lire('categorie'), variantes: [variante] });
    }
  }
  // Chaque groupe doit former une fiche valide (variantes nommées et distinctes, codes distincts).
  const groupes: GroupeImporte[] = [];
  const codesVus = new Set<string>();
  for (const g of parNom.values()) {
    const v = verifierProduit({ nomFr: g.nomFr, nomAr: g.nomAr, categorieId: null, variantes: g.variantes });
    const codes = v.ok ? v.saisie.variantes.flatMap((x) => (x.codeBarres ? [x.codeBarres] : [])) : [];
    const raison: Refus | null = !v.ok ? v.raison : codes.some((c) => codesVus.has(c)) ? 'code_barres_double' : null;
    if (raison) {
      for (const ligne of g.lignes) erreurs.push({ ligne, raison });
      continue;
    }
    for (const c of codes) codesVus.add(c);
    groupes.push(g);
  }
  erreurs.sort((a, b) => a.ligne - b.ligne);
  return { manquantes, reconnues, groupes, erreurs };
}

export interface BilanImport {
  produits: number;
  articles: number;
  ignorees: ErreurImport[];
}

/**
 * Crée les produits du tableau. Un produit déjà présent (même code-barres ou même nom) est laissé
 * tel quel et signalé : importer deux fois le même fichier ne crée pas de doublon.
 */
export async function importerProduits(trx: Trx, ctx: Contexte, lignes: string[][]): Promise<BilanImport | { manquantes: Colonne[] }> {
  const a = analyserTableau(lignes);
  if (a.manquantes.length) return { manquantes: a.manquantes };
  const bilan: BilanImport = { produits: 0, articles: 0, ignorees: [...a.erreurs] };
  const ignorer = (g: GroupeImporte, raison: ErreurImport['raison']) => bilan.ignorees.push(...g.lignes.map((ligne) => ({ ligne, raison })));
  for (const g of a.groupes) {
    const existant = await trx
      .selectFrom('produits')
      .select('id')
      .where('archive_le', 'is', null)
      .where((eb) => eb.or([
        ...(g.nomFr ? [eb(eb.fn('lower', ['nom_fr']), '=', g.nomFr.toLowerCase())] : []),
        ...(g.nomAr ? [eb('nom_ar', '=', g.nomAr)] : []),
      ]))
      .executeTakeFirst();
    if (existant) { ignorer(g, 'deja_present'); continue; }
    const categorieId = await trouverOuCreerCategorie(trx, ctx, g.categorie);
    const r = await creerProduit(trx, ctx, { nomFr: g.nomFr, nomAr: g.nomAr, categorieId, variantes: g.variantes }, 'import');
    if (!r.ok) { ignorer(g, r.raison === 'code_barres_pris' ? 'deja_present' : r.raison); continue; }
    bilan.produits++;
    bilan.articles += g.variantes.length;
  }
  bilan.ignorees.sort((x, y) => x.ligne - y.ligne);
  return bilan;
}
