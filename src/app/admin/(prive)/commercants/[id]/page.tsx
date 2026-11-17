import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { changerEtat, changerMaxEmployes, changerPaiementCarte, lienProprietaire, nouveauLien, retoucherModulesCommercant, saisirPaiement } from '@/app/actions/admin';
import { jourAlger, listerFormules, listerPaiements, MOYENS, situation } from '@/lib/abonnements';
import { MODULES } from '@/lib/droits';
import type { Langue } from '@/lib/types-bd';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, Pastille } from '@/components/ui';
import { bd } from '@/lib/bd';
import { formaterDate, formaterMontant, formaterTelephone } from '@/lib/formats';
import { reglage } from '@/lib/reglages-plateforme';
import { exigerAdmin } from '@/lib/web';

const TON = { actif: 'vert', lecture_seule: 'safran', suspendu: 'terre', archive: 'neutre' } as const;

export default async function FicheCommercant({ params }: { params: Promise<{ id: string }> }) {
  await exigerAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations('admin');
  const tr = await getTranslations('roles');
  const tc = await getTranslations('commun');
  const c = await bd('plateforme').selectFrom('commercants').select(['id', 'nom', 'etat', 'max_employes', 'cree_le', 'paiement_carte_actif', 'sous_domaine']).where('id', '=', id).executeTakeFirst();
  if (!c) notFound();
  const comptes = await bd('plateforme').selectFrom('utilisateurs').select(['id', 'nom', 'telephone', 'role']).where('commercant_id', '=', id).where('supprime_le', 'is', null).orderBy('cree_le').execute();
  const jours = await reglage('invitation_jours');
  const accepte = comptes.some((u) => u.role === 'proprietaire');
  const ta = await getTranslations('adminAbonnement');
  const tm = await getTranslations('modules');
  const tmo = await getTranslations('moyens');
  const langue = (await getLocale()) as Langue;
  const [ab, formules, paiements] = await Promise.all([
    situation(bd('plateforme'), id), listerFormules(bd('plateforme')), listerPaiements(bd('plateforme'), { commercantId: id, limite: 50 }),
  ]);
  const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
  const formuleProposee = ab.formule?.id ?? formules.find((f) => f.active)?.id;
  return (
    <>
      <EnTete admin titre={c.nom} retour="/admin" />
      <Page>
        <Carte className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pastille ton={TON[c.etat]}>{t(`etat.${c.etat}`)}</Pastille>
            {!accepte ? <Pastille ton="safran">{t('enAttente')}</Pastille> : null}
            <span className="text-sm text-doux">{t('creeLe', { date: formaterDate(c.cree_le) })}</span>
          </div>
          <form action={changerEtat}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="etat" value={c.etat === 'suspendu' ? 'actif' : 'suspendu'} />
            <button type="submit" className={c.etat === 'suspendu' ? classeBouton.secondaire : classeBouton.danger}>{t(c.etat === 'suspendu' ? 'reactiver' : 'suspendre')}</button>
          </form>
        </Carte>

        {/* ───── Abonnement ───── */}
        <Carte className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{ta('titre')}</h2>
            <Pastille ton={ab.etat === 'actif' ? 'vert' : ab.etat === 'sans' ? 'bleu' : ab.etat === 'archive' ? 'neutre' : ab.etat === 'lecture_seule' ? 'terre' : 'safran'}>{t(`abonnement.${ab.etat}`)}</Pastille>
          </div>
          {ab.formule && ab.debut && ab.fin ? (
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-doux">{ta('formule')}</dt><dd className="font-semibold">{ab.formule.nom}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-doux">{ta('periode')}</dt><dd className="chiffres">{date(ab.debut)} → {date(ab.fin)}</dd></div>
              {ab.etat === 'delai' && ab.finDelai ? <div className="flex justify-between gap-3"><dt className="text-doux">{ta('lectureSeuleLe')}</dt><dd className="chiffres">{date(ab.finDelai)}</dd></div> : null}
              <div className="flex justify-between gap-3"><dt className="text-doux">{ta('modules')}</dt><dd className="text-end">{[...(ab.autorises ?? [])].map((m) => tm(m)).join(', ')}</dd></div>
            </dl>
          ) : <p className="text-sm text-doux">{ta('sans')}</p>}
          {formules.length ? (
            <details>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-vert">{ta('saisirPaiement')}</summary>
              <Formulaire action={saisirPaiement} bouton={ta('enregistrerPaiement')} succes={ta('paiementOk')}>
                <input type="hidden" name="id" value={c.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{ta('formule')}</span>
                  <select name="formule" defaultValue={formuleProposee} className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre">
                    {formules.map((f) => <option key={f.id} value={f.id}>{`${f.nom} · ${formaterMontant(BigInt(f.prix), langue)} · ${ta('jours', { n: f.duree_jours })}${f.active ? '' : ` (${ta('inactive')})`}`}</option>)}
                  </select>
                </label>
                <Champ libelle={ta('montant')} name="montant" inputMode="decimal" dir="ltr" maxLength={12} autoComplete="off" aide={ta('montantAide')} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{ta('moyen')}</span>
                  <select name="moyen" className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre">
                    {MOYENS.map((m) => <option key={m} value={m}>{tmo(m)}</option>)}
                  </select>
                </label>
                <Champ libelle={ta('recuLe')} name="recuLe" type="date" defaultValue={jourAlger()} required />
                <Champ libelle={ta('reference')} name="reference" maxLength={80} autoComplete="off" />
                <Champ libelle={ta('note')} name="note" maxLength={300} autoComplete="off" />
                <p className="text-sm text-doux">{ta('regle')}</p>
              </Formulaire>
            </details>
          ) : <p className="text-sm text-doux">{ta('creerFormule')}</p>}
        </Carte>

        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{ta('retoucheTitre')}</h2>
          <p className="text-sm text-doux">{ta('retoucheTexte')}</p>
          <Formulaire action={retoucherModulesCommercant} bouton={tc('enregistrer')} style="secondaire" succes={tc('enregistre')} garder>
            <input type="hidden" name="id" value={c.id} />
            {MODULES.filter((m) => m !== 'stock').map((m) => (
              <label key={m} className="flex items-center justify-between gap-3">
                <span className="text-sm">{tm(m)}</span>
                <select name={`retouche_${m}`} defaultValue={ab.ajoutes.includes(m) ? 'ajoute' : ab.retires.includes(m) ? 'retire' : 'formule'} className="min-h-11 rounded-lg border border-trait bg-surface px-2 text-sm">
                  {(['formule', 'ajoute', 'retire'] as const).map((v) => <option key={v} value={v}>{ta(`retouche.${v}`)}</option>)}
                </select>
              </label>
            ))}
          </Formulaire>
        </Carte>

        {paiements.length ? (
          <Carte className="flex flex-col gap-2">
            <h2 className="font-semibold">{ta('historique')}</h2>
            <ul className="flex flex-col divide-y divide-trait text-sm">
              {paiements.map((p) => (
                <li key={p.id} className="flex flex-col py-2">
                  <span className="flex justify-between gap-3"><span>{date(p.recu_le)} · {tmo(p.moyen)}{p.reference ? ` · ${p.reference}` : ''}</span><span className="font-semibold">{formaterMontant(BigInt(p.montant), langue)}</span></span>
                  {p.debut && p.fin ? <span className="text-doux">{p.formule} · {date(p.debut)} → {date(p.fin)}</span> : null}
                </li>
              ))}
            </ul>
          </Carte>
        ) : null}

        <Carte className="flex flex-col gap-2">
          <h2 className="font-semibold">{t('boutique')}</h2>
          <p className="text-sm">{c.sous_domaine ? <a href={`/b/${c.sous_domaine}`} target="_blank" rel="noopener" dir="ltr" className="underline">/b/{c.sous_domaine}</a> : t('boutiqueSansAdresse')}</p>
          <p className="text-sm">{t(c.paiement_carte_actif ? 'carteActive' : 'carteInactive')}</p>
          <p className="text-xs text-doux">{t('carteAvertissement')}</p>
          <form action={changerPaiementCarte}>
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="actif" value={c.paiement_carte_actif ? 'non' : 'oui'} />
            <button type="submit" className={classeBouton.secondaire}>{t(c.paiement_carte_actif ? 'carteDesactiver' : 'carteActiver')}</button>
          </form>
        </Carte>

        <Carte>
          <ul className="flex flex-col divide-y divide-trait">
            {comptes.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium">{u.nom}</span>
                <span className="text-sm text-doux">{tr(u.role)} · <span className="chiffres">{formaterTelephone(u.telephone ?? '')}</span></span>
              </li>
            ))}
          </ul>
          {!accepte ? (
            <Formulaire action={nouveauLien} bouton={t('nouveauLien')} style="secondaire" texteLien={t('lienPret', { jours })} garder>
              <input type="hidden" name="id" value={c.id} />
            </Formulaire>
          ) : (
            <div className="pt-3">
              <Formulaire action={lienProprietaire} bouton={t('reinitialiser')} style="secondaire" texteLien={t('lienReinitPret')} garder>
                <input type="hidden" name="id" value={c.id} />
              </Formulaire>
            </div>
          )}
        </Carte>

        <Carte>
          <Formulaire action={changerMaxEmployes} bouton={tc('enregistrer')} style="secondaire" succes={tc('enregistre')} garder>
            <input type="hidden" name="id" value={c.id} />
            <Champ libelle={t('maxEmployes')} name="max" inputMode="numeric" dir="ltr" defaultValue={c.max_employes ?? ''} maxLength={4} />
          </Formulaire>
        </Carte>
      </Page>
    </>
  );
}
