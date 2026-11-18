// Photos des produits. Toute image envoyée est décodée, redressée, réduite et réécrite en WebP :
// le fichier d'origine n'est jamais gardé ni renvoyé (ni ses métadonnées, comme la position GPS).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { Trx } from './bd.ts';
import type { Contexte } from './stock.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_OCTETS_PHOTO = 3_000_000;

const racine = () => resolve(/* turbopackIgnore: true */ process.env.DOSSIER_FICHIERS || './donnees');
function chemin(commercantId: string, photoId: string, petite: boolean): string {
  if (!UUID.test(commercantId) || !UUID.test(photoId)) throw new Error('Identifiant de photo invalide');
  return join(racine(), commercantId, `${photoId}${petite ? '-p' : ''}.webp`);
}

/** Vérifie que les octets sont bien une image et produit les deux tailles gardées. Null si ce n'en est pas une. */
export async function preparerPhoto(octets: Uint8Array): Promise<{ grande: Buffer; petite: Buffer } | null> {
  if (!octets.length || octets.length > MAX_OCTETS_PHOTO) return null;
  try {
    const source = sharp(octets, { limitInputPixels: 50_000_000, failOn: 'error' });
    const { format } = await source.metadata();
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return null;
    const droite = source.rotate(); // applique l'orientation de l'appareil photo, puis l'oublie
    const grande = await droite.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const petite = await droite.clone().resize(192, 192, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();
    return { grande, petite };
  } catch {
    return null;
  }
}

async function effacerFichiers(commercantId: string, photoId: string): Promise<void> {
  await Promise.all([true, false].map((petite) => rm(chemin(commercantId, photoId, petite), { force: true })));
}

export type Images = NonNullable<Awaited<ReturnType<typeof preparerPhoto>>>;

/** Remplace la photo d'un produit par des images déjà vérifiées par `preparerPhoto`. */
/** Nombre de photos au plus par produit. */
export const MAX_PHOTOS = 6;

async function ecrireFichiers(ctx: Contexte, id: string, images: Images): Promise<void> {
  await mkdir(join(racine(), ctx.commercantId), { recursive: true });
  await writeFile(chemin(ctx.commercantId, id, false), images.grande);
  await writeFile(chemin(ctx.commercantId, id, true), images.petite);
}

/** Photo principale (la première) : remplacée par la nouvelle ; les autres photos restent. */
export async function enregistrerPhoto(trx: Trx, ctx: Contexte, produitId: string, images: Images): Promise<void> {
  const premiere = await trx.selectFrom('photos_produit').select(['id', 'ordre']).where('produit_id', '=', produitId).orderBy('ordre').orderBy('cree_le', 'desc').executeTakeFirst();
  if (premiere) await trx.deleteFrom('photos_produit').where('id', '=', premiere.id).execute();
  const { id } = await trx.insertInto('photos_produit').values({ commercant_id: ctx.commercantId, produit_id: produitId, ordre: premiere?.ordre ?? 0 }).returning('id').executeTakeFirstOrThrow();
  await ecrireFichiers(ctx, id, images);
  if (premiere) await effacerFichiers(ctx.commercantId, premiere.id);
}

/** Retire la photo principale (les autres restent ; la suivante devient la principale). */
export async function supprimerPhoto(trx: Trx, ctx: Contexte, produitId: string): Promise<void> {
  const premiere = await trx.selectFrom('photos_produit').select('id').where('produit_id', '=', produitId).orderBy('ordre').orderBy('cree_le', 'desc').executeTakeFirst();
  if (premiere) await retirerPhoto(trx, ctx, premiere.id);
}

/** Photos d'un produit, la principale d'abord. */
export const photosProduit = async (trx: Trx, produitId: string): Promise<string[]> =>
  (await trx.selectFrom('photos_produit').select('id').where('produit_id', '=', produitId).orderBy('ordre').orderBy('cree_le', 'desc').execute()).map((p) => p.id);

/** Ajoute une photo à la fin de la galerie du produit (6 au plus). */
export async function ajouterPhoto(trx: Trx, ctx: Contexte, produitId: string, images: Images): Promise<'ok' | 'trop_de_photos' | 'introuvable'> {
  const p = await trx.selectFrom('produits').select('id').where('id', '=', produitId).executeTakeFirst();
  if (!p) return 'introuvable';
  const actuelles = await trx.selectFrom('photos_produit').select(['ordre']).where('produit_id', '=', produitId).execute();
  if (actuelles.length >= MAX_PHOTOS) return 'trop_de_photos';
  const ordre = actuelles.length ? Math.max(...actuelles.map((x) => x.ordre)) + 1 : 0;
  const { id } = await trx.insertInto('photos_produit').values({ commercant_id: ctx.commercantId, produit_id: produitId, ordre }).returning('id').executeTakeFirstOrThrow();
  await ecrireFichiers(ctx, id, images);
  return 'ok';
}

/** Retire une photo de produit (jamais le logo ou la bannière de la boutique par ce chemin). */
export async function retirerPhoto(trx: Trx, ctx: Contexte, photoId: string): Promise<boolean> {
  const r = await trx.deleteFrom('photos_produit').where('id', '=', photoId).where('produit_id', 'is not', null).returning('id').executeTakeFirst();
  if (r) await effacerFichiers(ctx.commercantId, r.id);
  return !!r;
}

/** Met une photo en premier : elle devient la photo principale (liste, caisse, boutique). */
export async function photoEnPremier(trx: Trx, photoId: string): Promise<boolean> {
  const ph = await trx.selectFrom('photos_produit').select(['produit_id']).where('id', '=', photoId).where('produit_id', 'is not', null).executeTakeFirst();
  if (!ph) return false;
  const min = await trx.selectFrom('photos_produit').select((eb) => eb.fn.min<number>('ordre').as('m')).where('produit_id', '=', ph.produit_id!).executeTakeFirstOrThrow();
  await trx.updateTable('photos_produit').set({ ordre: Number(min.m ?? 0) - 1 }).where('id', '=', photoId).execute();
  return true;
}

/** Lit une photo, seulement si elle appartient au commerçant de la transaction. */
export async function lirePhoto(trx: Trx, commercantId: string, photoId: string, petite: boolean): Promise<Buffer | null> {
  if (!UUID.test(photoId)) return null;
  const photo = await trx.selectFrom('photos_produit').select('id').where('id', '=', photoId).executeTakeFirst();
  if (!photo) return null;
  try {
    return await readFile(chemin(commercantId, photo.id, petite));
  } catch {
    return null;
  }
}

/** Image de la boutique (logo, bannière) : rangée comme une photo, sans produit. Renvoie son identifiant. */
export async function enregistrerImageLibre(trx: Trx, ctx: Contexte, images: Images): Promise<string> {
  const { id } = await trx.insertInto('photos_produit').values({ commercant_id: ctx.commercantId, produit_id: null }).returning('id').executeTakeFirstOrThrow();
  await mkdir(join(racine(), ctx.commercantId), { recursive: true });
  await writeFile(chemin(ctx.commercantId, id, false), images.grande);
  await writeFile(chemin(ctx.commercantId, id, true), images.petite);
  return id;
}

export async function supprimerImageLibre(trx: Trx, ctx: Contexte, photoId: string): Promise<void> {
  const r = await trx.deleteFrom('photos_produit').where('id', '=', photoId).where('produit_id', 'is', null).returning('id').execute();
  for (const a of r) await effacerFichiers(ctx.commercantId, a.id);
}
