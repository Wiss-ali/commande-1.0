import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { changerEtat, changerMaxEmployes, changerPaiementCarte, lienProprietaire, nouveauLien } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, Pastille } from '@/components/ui';
import { bd } from '@/lib/bd';
import { formaterDate, formaterTelephone } from '@/lib/formats';
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
