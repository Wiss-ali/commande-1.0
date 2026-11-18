'use server';
// Actions réservées à l'administrateur de la plateforme. Chacune revérifie sa session et sa double authentification.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { action, actionSimple, secret, texte } from '@/lib/actions';
import { enregistrerFormule, enregistrerPaiement, MOYENS, retoucherModules } from '@/lib/abonnements';
import { bd } from '@/lib/bd';
import { MODULES } from '@/lib/droits';
import type { MoyenPaiement, NomModule } from '@/lib/types-bd';
import { activerTotp, connecterAdmin, preparerTotp, verifierCode } from '@/lib/comptes';
import { schemaBaremeTimbre } from '@/lib/fiscal';
import { analyserMontant, normaliserTelephone } from '@/lib/formats';
import { inviterCommercant, reinitialiserProprietaire, reinviterCommercant } from '@/lib/invitations';
import { journaliser } from '@/lib/journal';
import { qrEnImage } from '@/lib/qr';
import { oublierReglages } from '@/lib/reglages-plateforme';
import { adresseTotp } from '@/lib/totp';
import { adresseLien, exigerAdmin, fermerSession, infoRequete, ouvrirSession, sessionAdmin } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export const adminConnexion = action(async (f) => {
  const identifiant = texte(f, 'identifiant', 100).toLowerCase();
  const motDePasse = secret(f, 'motDePasse');
  if (!identifiant || !motDePasse) return { erreur: 'identifiants' };
  const { ip } = await infoRequete();
  const r = await connecterAdmin({ identifiant, motDePasse, ip });
  if (!r.ok) return { erreur: r.raison };
  // La session reste incomplète tant que le code n'est pas saisi : la double authentification est obligatoire.
  await ouvrirSession({ administrateurId: r.id }, false);
  redirect(r.totpActif ? '/admin/connexion/code' : '/admin/connexion/activation');
});

export const adminCode = action(async (f) => {
  const s = await sessionAdmin();
  if (!s) redirect('/admin/connexion');
  if (!(await verifierCode('administrateurs', s.administrateur.id, texte(f, 'code', 20)))) return { erreur: 'code_invalide' };
  await ouvrirSession({ administrateurId: s.administrateur.id }, true);
  redirect('/admin');
});

export const adminPreparer2fa = action(async () => {
  const s = await sessionAdmin();
  if (!s || s.administrateur.totpActif) return { erreur: 'interdit' };
  const cle = await preparerTotp('administrateurs', s.administrateur.id);
  return { qr: qrEnImage(adresseTotp(cle, s.administrateur.identifiant)), cle };
});

export const adminActiver2fa = action(async (f) => {
  const s = await sessionAdmin();
  if (!s || s.administrateur.totpActif) return { erreur: 'interdit' };
  const codes = await activerTotp('administrateurs', s.administrateur.id, texte(f, 'code', 10));
  if (!codes) return { erreur: 'code_invalide' };
  await ouvrirSession({ administrateurId: s.administrateur.id }, true);
  return { ok: true, codes };
});

export const adminDeconnexion = actionSimple(async () => {
  await fermerSession('administrateur');
  redirect('/admin/connexion');
});

export const creerCommercant = action(async (f) => {
  const s = await exigerAdmin();
  const nomCommercant = texte(f, 'nomMagasin', 120);
  const nom = texte(f, 'nom', 80);
  const telephone = normaliserTelephone(texte(f, 'telephone', 30));
  if (!nomCommercant || !nom) return { erreur: 'champ_requis' };
  if (!telephone) return { erreur: 'telephone_invalide' };
  const r = await inviterCommercant({ adminId: s.administrateur.id, nomCommercant, nom, telephone });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/admin');
  return { ok: true, lien: adresseLien(r.jeton) };
});

export const nouveauLien = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'inconnue' };
  const r = await reinviterCommercant({ adminId: s.administrateur.id, commercantId: id });
  return r.ok ? { ok: true, lien: adresseLien(r.jeton) } : { erreur: 'lien_invalide' };
});

export const lienProprietaire = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'inconnue' };
  const r = await reinitialiserProprietaire({ adminId: s.administrateur.id, commercantId: id });
  return r.ok ? { ok: true, lien: adresseLien(r.jeton) } : { erreur: 'inconnue' };
});

export const changerEtat = actionSimple(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  const etat = f.get('etat') === 'suspendu' ? 'suspendu' : 'actif';
  if (!UUID.test(id)) return;
  const { ip } = await infoRequete();
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('commercants').set({ etat }).where('id', '=', id).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: `commercant.${etat}`, objetType: 'commercant', objetId: id, ip });
  });
  revalidatePath('/admin', 'layout');
});

export const changerMaxEmployes = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  const saisie = texte(f, 'max', 6);
  if (!UUID.test(id) || (saisie && !/^\d{1,4}$/.test(saisie))) return { erreur: 'champ_requis' };
  const max = saisie ? Number(saisie) : null;
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('commercants').set({ max_employes: max }).where('id', '=', id).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'commercant.max_employes', details: { max } });
  });
  return { ok: true };
});

/** Barème du droit de timbre, commun à tous les commerçants. Laisser le tableau vide : aucun timbre. */
export const enregistrerTimbre = action(async (f) => {
  const s = await exigerAdmin();
  const montant = (nom: string) => (texte(f, nom, 20) ? analyserMontant(texte(f, nom, 20)) : undefined);
  const tranches: { jusqua: number | null; parCent: number }[] = [];
  for (const i of [1, 2, 3, 4]) {
    const parCent = montant(`parCent${i}`);
    const jusqua = montant(`jusqua${i}`);
    if (parCent === undefined && jusqua === undefined) continue;
    if (parCent === null || parCent === undefined || jusqua === null) return { erreur: 'montant_invalide' };
    tranches.push({ jusqua: jusqua || null, parCent });
  }
  const exonere = montant('exonere');
  const minimum = montant('minimum');
  const plafond = montant('plafond');
  if (exonere === null || minimum === null || plafond === null) return { erreur: 'montant_invalide' };
  const lu = schemaBaremeTimbre.safeParse({ exonereJusqua: exonere ?? 0, tranches, minimum: minimum ?? 0, plafond: plafond || null });
  if (!lu.success) return { erreur: 'montant_invalide' };
  const { ip } = await infoRequete();
  await bd('plateforme').updateTable('reglages_plateforme').set({ valeur: JSON.stringify(lu.data), modifie_le: new Date() }).where('cle', '=', 'timbre').execute();
  await journaliser(bd('plateforme'), { commercantId: null, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'timbre.modifie', details: { tranches: lu.data.tranches.length }, ip });
  oublierReglages();
  revalidatePath('/admin/reglages');
  return { ok: true };
});

/** Demande d'un commerçant (paiement par carte, site personnalisé) : traitée ou refusée, avec une note. */
export const traiterDemande = actionSimple(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  const etat = f.get('etat') === 'refusee' ? 'refusee' : 'traitee';
  if (!UUID.test(id)) return;
  const { ip } = await infoRequete();
  await bd('plateforme').transaction().execute(async (trx) => {
    const d = await trx.updateTable('demandes').set({ etat, note_admin: texte(f, 'note', 500), traitee_le: new Date() }).where('id', '=', id).where('etat', '=', 'nouvelle').returning('commercant_id').executeTakeFirst();
    if (d) await journaliser(trx, { commercantId: d.commercant_id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: `demande.${etat}`, objetType: 'demande', objetId: id, ip });
  });
  revalidatePath('/admin', 'layout');
});

/** Seul l'administrateur active le paiement par carte d'un commerçant (aucune passerelle n'est branchée aujourd'hui). */
export const changerPaiementCarte = actionSimple(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return;
  const actif = f.get('actif') === 'oui';
  const { ip } = await infoRequete();
  await bd('plateforme').transaction().execute(async (trx) => {
    await trx.updateTable('commercants').set({ paiement_carte_actif: actif }).where('id', '=', id).execute();
    await journaliser(trx, { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: actif ? 'paiement_carte.active' : 'paiement_carte.desactive', objetType: 'commercant', objetId: id, ip });
  });
  revalidatePath('/admin', 'layout');
});


// ───────────── Abonnements ─────────────

const modulesCoches = (f: FormData, prefixe: string): NomModule[] => MODULES.filter((m) => f.get(`${prefixe}${m}`) === 'on');

/** Crée ou modifie une formule : nom, prix, durée en jours, modules compris, active. */
export const sauverFormule = action(async (f) => {
  const s = await exigerAdmin();
  const prix = analyserMontant(texte(f, 'prix', 20));
  if (prix === null) return { erreur: 'montant_invalide' };
  const duree = texte(f, 'duree', 5);
  const id = texte(f, 'id', 40);
  const r = await enregistrerFormule(bd('plateforme'), {
    id: UUID.test(id) ? id : undefined, nom: texte(f, 'nom', 60), prix, dureeJours: /^\d{1,4}$/.test(duree) ? Number(duree) : 0,
    modules: modulesCoches(f, 'module_'), active: f.get('active') === 'on',
  });
  if (!r.ok) return { erreur: r.raison };
  const { ip } = await infoRequete();
  await journaliser(bd('plateforme'), { commercantId: null, acteurType: 'administrateur', acteurId: s.administrateur.id, action: id ? 'formule.modifiee' : 'formule.creee', objetType: 'formule', objetId: r.id, ip });
  revalidatePath('/admin', 'layout');
  return { ok: true };
});

/** Paiement reçu hors de l'application (CCP, BaridiMob, virement, espèces) : prolonge l'abonnement. */
export const saisirPaiement = action(async (f) => {
  const s = await exigerAdmin();
  const commercantId = texte(f, 'id', 40);
  const formuleId = texte(f, 'formule', 40);
  if (!UUID.test(commercantId) || !UUID.test(formuleId)) return { erreur: 'champ_requis' };
  const saisi = texte(f, 'montant', 20);
  const montant = saisi ? analyserMontant(saisi) : undefined;
  if (montant === null) return { erreur: 'montant_invalide' };
  const moyen = MOYENS.find((m) => m === f.get('moyen')) as MoyenPaiement | undefined;
  if (!moyen) return { erreur: 'champ_requis' };
  const { ip } = await infoRequete();
  const r = await bd('plateforme').transaction().execute(async (trx) => {
    const fait = await enregistrerPaiement(trx, s.administrateur.id, { commercantId, formuleId, montant, moyen, recuLe: texte(f, 'recuLe', 10), reference: texte(f, 'reference', 80), note: texte(f, 'note', 300) });
    if (fait.ok) await journaliser(trx, { commercantId, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'abonnement.paiement', objetType: 'commercant', objetId: commercantId, details: { moyen, fin: fait.fin }, ip });
    return fait;
  });
  if (!r.ok) return { erreur: r.raison };
  revalidatePath('/admin', 'layout');
  return { ok: true };
});

/** Retouche des modules d'un commerçant : « selon la formule », « ajouté » ou « retiré », module par module. */
export const retoucherModulesCommercant = action(async (f) => {
  const s = await exigerAdmin();
  const id = texte(f, 'id', 40);
  if (!UUID.test(id)) return { erreur: 'champ_requis' };
  const ajoutes = MODULES.filter((m) => f.get(`retouche_${m}`) === 'ajoute');
  const retires = MODULES.filter((m) => f.get(`retouche_${m}`) === 'retire');
  await retoucherModules(bd('plateforme'), id, ajoutes, retires);
  const { ip } = await infoRequete();
  await journaliser(bd('plateforme'), { commercantId: id, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'abonnement.modules', details: { ajoutes: ajoutes.join(','), retires: retires.join(',') }, ip });
  revalidatePath('/admin', 'layout');
  return { ok: true };
});

/** Délais : accès complet après la fin, durée de la lecture seule avant archivage, jours des rappels. */
export const enregistrerDelais = action(async (f) => {
  const s = await exigerAdmin();
  const lire = (nom: string, min: number, max: number) => {
    const v = texte(f, nom, 4);
    return /^\d{1,4}$/.test(v) && Number(v) >= min && Number(v) <= max ? Number(v) : null;
  };
  const valeurs = { delai_grace_jours: lire('grace', 0, 60), lecture_seule_jours: lire('lecture', 1, 3650), rappel_jours_1: lire('rappel1', 1, 60), rappel_jours_2: lire('rappel2', 0, 60), conservation_ans: lire('conservation', 1, 50) };
  if (Object.values(valeurs).some((v) => v === null)) return { erreur: 'champ_requis' };
  await bd('plateforme').transaction().execute(async (trx) => {
    for (const [cle, valeur] of Object.entries(valeurs)) {
      await trx.updateTable('reglages_plateforme').set({ valeur: JSON.stringify(valeur), modifie_le: new Date() }).where('cle', '=', cle).execute();
    }
    const { ip } = await infoRequete();
    await journaliser(trx, { commercantId: null, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'abonnement.delais', details: valeurs as Record<string, number>, ip });
  });
  oublierReglages();
  revalidatePath('/admin', 'layout');
  return { ok: true };
});

/** Liste officielle des wilayas : noms et état, modifiables (ex. publication au Journal officiel). */
export const enregistrerWilayas = action(async (f) => {
  const s = await exigerAdmin();
  const wilayas = await bd('plateforme').selectFrom('wilayas').select(['code']).execute();
  const lignes: { code: number; fr: string; ar: string; active: boolean }[] = [];
  for (const { code } of wilayas) {
    const fr = texte(f, `fr_${code}`, 60);
    const ar = texte(f, `ar_${code}`, 60);
    if (!fr || !ar) return { erreur: 'champ_requis' };
    lignes.push({ code, fr, ar, active: f.get(`active_${code}`) === 'on' });
  }
  await bd('plateforme').transaction().execute(async (trx) => {
    for (const l of lignes) await trx.updateTable('wilayas').set({ nom_fr: l.fr, nom_ar: l.ar, active: l.active }).where('code', '=', l.code).execute();
    const { ip } = await infoRequete();
    await journaliser(trx, { commercantId: null, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'wilayas.modifiees', ip });
  });
  revalidatePath('/admin/wilayas');
  return { ok: true };
});

/** Communes d'une wilaya : noms, commune proposée ou non, et ajout d'une commune oubliée. */
export const enregistrerCommunes = action(async (f) => {
  const s = await exigerAdmin();
  const wilaya = Number(texte(f, 'wilaya', 3));
  if (!Number.isInteger(wilaya) || wilaya < 1 || wilaya > 99) return { erreur: 'introuvable' };
  const communes = await bd('plateforme').selectFrom('communes').select(['id']).where('wilaya_code', '=', wilaya).execute();
  const lignes: { id: number; fr: string; ar: string; active: boolean }[] = [];
  for (const { id } of communes) {
    const fr = texte(f, `fr_${id}`, 80);
    if (!fr) return { erreur: 'champ_requis' };
    lignes.push({ id, fr, ar: texte(f, `ar_${id}`, 80), active: f.get(`active_${id}`) === 'on' });
  }
  const nouvelle = { fr: texte(f, 'nouvelle_fr', 80), ar: texte(f, 'nouvelle_ar', 80) };
  if (new Set([...lignes.map((l) => l.fr.toLowerCase()), ...(nouvelle.fr ? [nouvelle.fr.toLowerCase()] : [])]).size !== lignes.length + (nouvelle.fr ? 1 : 0)) return { erreur: 'commune_double' };
  await bd('plateforme').transaction().execute(async (trx) => {
    for (const l of lignes) await trx.updateTable('communes').set({ nom_fr: l.fr, nom_ar: l.ar, active: l.active }).where('id', '=', l.id).execute();
    if (nouvelle.fr) await trx.insertInto('communes').values({ wilaya_code: wilaya, nom_fr: nouvelle.fr, nom_ar: nouvelle.ar }).execute();
    const { ip } = await infoRequete();
    await journaliser(trx, { commercantId: null, acteurType: 'administrateur', acteurId: s.administrateur.id, action: 'communes.modifiees', details: { wilaya }, ip });
  });
  revalidatePath(`/admin/wilayas/${wilaya}`);
  return { ok: true };
});
