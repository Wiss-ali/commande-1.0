import { sql } from 'kysely';
import { getTranslations } from 'next-intl/server';
import { creerCommercant, traiterDemande } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, EtatVide, LigneLien, Pastille, TitreSection } from '@/components/ui';
import { bd } from '@/lib/bd';
import { formaterDate, formaterTelephone } from '@/lib/formats';
import { reglage } from '@/lib/reglages-plateforme';
import type { EtatCommercant } from '@/lib/types-bd';
import { exigerAdmin } from '@/lib/web';

const TON = { actif: 'vert', lecture_seule: 'safran', suspendu: 'terre', archive: 'neutre' } as const;

// Écran minimal de l'administration : commerçants et demandes. Abonnements et paiements arrivent à l'étape 7.
export default async function AdminAccueil() {
  await exigerAdmin();
  const t = await getTranslations('admin');
  const jours = await reglage('invitation_jours');
  const { rows } = await sql<{ id: string; nom: string; etat: EtatCommercant; cree_le: Date; comptes: string; en_attente: boolean }>`
    SELECT c.id, c.nom, c.etat, c.cree_le,
      (SELECT count(*) FROM utilisateurs u WHERE u.commercant_id = c.id AND u.supprime_le IS NULL) AS comptes,
      EXISTS (SELECT 1 FROM invitations i WHERE i.commercant_id = c.id AND i.type = 'commercant' AND i.utilisee_le IS NULL AND i.annulee_le IS NULL AND i.expire_le > now()) AS en_attente
    FROM commercants c ORDER BY c.cree_le DESC LIMIT 500`.execute(bd('plateforme'));
  const demandes = await bd('plateforme')
    .selectFrom('demandes as d').innerJoin('commercants as c', 'c.id', 'd.commercant_id')
    .select(['d.id', 'd.type', 'd.nom', 'd.telephone', 'd.message', 'd.cree_le', 'c.nom as commercant', 'c.id as commercant_id'])
    .where('d.etat', '=', 'nouvelle').orderBy('d.cree_le').limit(100).execute();
  return (
    <>
      <EnTete admin titre={t('titre')} />
      <Page>
        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('nouveau')}</h2>
          <Formulaire action={creerCommercant} bouton={t('creer')} texteLien={t('lienPret', { jours })}>
            <Champ libelle={t('nomMagasin')} name="nomMagasin" maxLength={120} autoComplete="off" required />
            <Champ libelle={t('nomProprietaire')} name="nom" maxLength={80} autoComplete="off" required />
            <Champ libelle={t('telephoneProprietaire')} name="telephone" type="tel" inputMode="tel" dir="ltr" placeholder="0550 12 34 56" autoComplete="off" required />
          </Formulaire>
        </Carte>
        <LigneLien href="/admin/reglages" titre={t('reglages')} aide={t('reglagesAide')} />
        <TitreSection>{t('demandes', { n: demandes.length })}</TitreSection>
        {demandes.length ? (
          <ul className="flex flex-col gap-2">
            {demandes.map((d) => (
              <li key={d.id}>
                <Carte className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={`/admin/commercants/${d.commercant_id}`} className="font-semibold underline">{d.commercant}</a>
                    <Pastille ton="safran">{t(`demande.${d.type}`)}</Pastille>
                  </div>
                  <p className="text-sm">{d.nom} · <a href={`tel:${d.telephone}`} dir="ltr" className="chiffres underline">{formaterTelephone(d.telephone)}</a> · <span className="chiffres text-doux">{formaterDate(d.cree_le)}</span></p>
                  {d.message ? <p className="whitespace-pre-line text-sm">{d.message}</p> : null}
                  <form action={traiterDemande} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={d.id} />
                    <Champ libelle={t('demandeNote')} name="note" maxLength={500} autoComplete="off" />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="submit" name="etat" value="traitee" className={classeBouton.secondaire}>{t('demandeTraitee')}</button>
                      <button type="submit" name="etat" value="refusee" className={classeBouton.danger}>{t('demandeRefusee')}</button>
                    </div>
                  </form>
                </Carte>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-doux">{t('aucuneDemande')}</p>}
        <TitreSection>{t('commercants')}</TitreSection>
        {rows.length ? (
          <div className="flex flex-col gap-2">
            {rows.map((c) => (
              <LigneLien
                key={c.id}
                href={`/admin/commercants/${c.id}`}
                titre={c.nom}
                aide={`${t('creeLe', { date: formaterDate(c.cree_le) })} · ${t('membres', { n: Number(c.comptes) })}`}
                fin={c.en_attente ? <Pastille ton="safran">{t('enAttente')}</Pastille> : <Pastille ton={TON[c.etat]}>{t(`etat.${c.etat}`)}</Pastille>}
              />
            ))}
          </div>
        ) : (
          <EtatVide titre={t('videTitre')} texte={t('videTexte')} />
        )}
      </Page>
    </>
  );
}
