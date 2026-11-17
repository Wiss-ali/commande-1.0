import { CalendarClock, Map as Carte2, Receipt, Settings, Tags } from 'lucide-react';
import { sql } from 'kysely';
import { getLocale, getTranslations } from 'next-intl/server';
import { creerCommercant, traiterDemande } from '@/app/actions/admin';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, classeBouton, EtatVide, LigneLien, Pastille, TitreSection } from '@/components/ui';
import { appliquerEcheances, etatDepuisFin, jourAlger, lireDelais, tableauAbonnements, type EtatAbonnement } from '@/lib/abonnements';
import { bd } from '@/lib/bd';
import { formaterDate, formaterMontant, formaterTelephone } from '@/lib/formats';
import { reglage } from '@/lib/reglages-plateforme';
import type { EtatCommercant, Langue } from '@/lib/types-bd';
import { exigerAdmin } from '@/lib/web';

const TON = { actif: 'vert', lecture_seule: 'safran', suspendu: 'terre', archive: 'neutre' } as const;
const TON_ABONNEMENT: Record<EtatAbonnement, 'vert' | 'safran' | 'terre' | 'neutre' | 'bleu'> = { actif: 'vert', bientot: 'safran', delai: 'safran', lecture_seule: 'terre', archive: 'neutre', sans: 'bleu' };
const FILTRES = ['tous', 'bientot', 'delai', 'lecture_seule', 'sans'] as const;

/** Tableau de l'administration : abonnements, revenu du mois, demandes, commerçants. */
export default async function AdminAccueil({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await exigerAdmin();
  const t = await getTranslations('admin');
  const langue = (await getLocale()) as Langue;
  const choisi = (await searchParams).f;
  const filtre = FILTRES.find((x) => x === choisi) ?? 'tous';
  // Les échéances passées sont appliquées à l'ouverture (la tâche périodique le fait aussi).
  await appliquerEcheances(bd('plateforme'));
  const [jours, delais, tableau] = await Promise.all([reglage('invitation_jours'), lireDelais(), tableauAbonnements(bd('plateforme'))]);
  const aujourdhui = jourAlger();
  const { rows } = await sql<{ id: string; nom: string; etat: EtatCommercant; cree_le: Date; comptes: string; en_attente: boolean; fin: string | null; formule: string | null }>`
    SELECT c.id, c.nom, c.etat, c.cree_le,
      (SELECT count(*) FROM utilisateurs u WHERE u.commercant_id = c.id AND u.supprime_le IS NULL) AS comptes,
      EXISTS (SELECT 1 FROM invitations i WHERE i.commercant_id = c.id AND i.type = 'commercant' AND i.utilisee_le IS NULL AND i.annulee_le IS NULL AND i.expire_le > now()) AS en_attente,
      (SELECT to_char(a.fin, 'YYYY-MM-DD') FROM abonnements a WHERE a.commercant_id = c.id ORDER BY a.fin DESC LIMIT 1) AS fin,
      (SELECT f.nom FROM abonnements a JOIN formules f ON f.id = a.formule_id WHERE a.commercant_id = c.id ORDER BY a.fin DESC LIMIT 1) AS formule
    FROM commercants c ORDER BY c.cree_le DESC LIMIT 500`.execute(bd('plateforme'));
  const liste = rows.map((c) => ({ ...c, abonnement: etatDepuisFin(c.fin, aujourdhui, delais) }))
    .filter((c) => filtre === 'tous' || c.abonnement === filtre || (filtre === 'lecture_seule' && c.abonnement === 'archive'));
  const demandes = await bd('plateforme')
    .selectFrom('demandes as d').innerJoin('commercants as c', 'c.id', 'd.commercant_id')
    .select(['d.id', 'd.type', 'd.nom', 'd.telephone', 'd.message', 'd.cree_le', 'c.nom as commercant', 'c.id as commercant_id'])
    .where('d.etat', '=', 'nouvelle').orderBy('d.cree_le').limit(100).execute();
  const tuiles = [
    { cle: 'actifs', valeur: String(tableau.actifs), lien: '/admin?f=tous' },
    { cle: 'bientot', valeur: String(tableau.bientot), lien: '/admin?f=bientot', alerte: tableau.bientot > 0 },
    { cle: 'delaiLecture', valeur: String(tableau.delai + tableau.lectureSeule), lien: '/admin?f=lecture_seule', alerte: tableau.delai + tableau.lectureSeule > 0 },
    { cle: 'revenuMois', valeur: formaterMontant(tableau.revenuMois, langue), lien: '/admin/paiements' },
  ];

  return (
    <>
      <EnTete admin titre={t('titre')} />
      <Page>
        <ul className="grid grid-cols-2 gap-2">
          {tuiles.map((x) => (
            <li key={x.cle}>
              <a href={x.lien} className={`flex min-h-24 flex-col justify-between gap-1 rounded-xl border bg-surface p-3 ${x.alerte ? 'border-safran' : 'border-trait'}`}>
                <span className="text-sm text-doux">{t(`tuile.${x.cle}`)}</span>
                <span className="text-xl font-bold">{x.valeur}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <LigneLien href="/admin/formules" titre={t('formules')} aide={t('formulesAide')} icone={<Tags aria-hidden className="size-5" />} />
          <LigneLien href="/admin/paiements" titre={t('paiements')} aide={t('paiementsAide', { n: tableau.paiementsMois })} icone={<Receipt aria-hidden className="size-5" />} />
          <LigneLien href="/admin/wilayas" titre={t('wilayas')} aide={t('wilayasAide')} icone={<Carte2 aria-hidden className="size-5" />} />
          <LigneLien href="/admin/reglages" titre={t('reglages')} aide={t('reglagesAide')} icone={<Settings aria-hidden className="size-5" />} />
        </div>

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

        <Carte className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('nouveau')}</h2>
          <Formulaire action={creerCommercant} bouton={t('creer')} texteLien={t('lienPret', { jours })}>
            <Champ libelle={t('nomMagasin')} name="nomMagasin" maxLength={120} autoComplete="off" required />
            <Champ libelle={t('nomProprietaire')} name="nom" maxLength={80} autoComplete="off" required />
            <Champ libelle={t('telephoneProprietaire')} name="telephone" type="tel" inputMode="tel" dir="ltr" placeholder="0550 12 34 56" autoComplete="off" required />
          </Formulaire>
        </Carte>

        <TitreSection>{t('commercants')}</TitreSection>
        <nav aria-label={t('filtres')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTRES.map((x) => (
            <a key={x} href={`/admin?f=${x}`} aria-current={x === filtre ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${x === filtre ? 'border-vert bg-vert-pale text-vert' : 'border-trait bg-surface'}`}>{t(`filtre.${x}`)}</a>
          ))}
        </nav>
        {liste.length ? (
          <div className="flex flex-col gap-2">
            {liste.map((c) => (
              <LigneLien
                key={c.id}
                href={`/admin/commercants/${c.id}`}
                titre={c.nom}
                icone={c.abonnement === 'bientot' || c.abonnement === 'delai' ? <CalendarClock aria-hidden className="size-5 text-sur-safran" /> : undefined}
                aide={`${c.formule ? `${c.formule} · ` : ''}${c.fin ? t('jusquau', { date: formaterDate(new Date(`${c.fin}T12:00:00Z`)) }) : t('creeLe', { date: formaterDate(c.cree_le) })} · ${t('membres', { n: Number(c.comptes) })}`}
                fin={c.en_attente ? <Pastille ton="safran">{t('enAttente')}</Pastille>
                  : c.etat === 'suspendu' ? <Pastille ton={TON.suspendu}>{t('etat.suspendu')}</Pastille>
                  : <Pastille ton={TON_ABONNEMENT[c.abonnement]}>{t(`abonnement.${c.abonnement}`)}</Pastille>}
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
