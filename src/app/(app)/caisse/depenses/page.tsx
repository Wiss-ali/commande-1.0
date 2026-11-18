import { randomUUID } from 'node:crypto';
import { getLocale, getTranslations } from 'next-intl/server';
import { annulerDepenseAction, enregistrerDepense } from '@/app/actions/argent';
import { EnTete } from '@/components/EnTete';
import { Formulaire } from '@/components/Formulaire';
import { Page } from '@/components/Page';
import { Carte, Champ, EtatVide, Pastille, TitreSection } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerDepenses, totalDepenses } from '@/lib/depenses';
import { formaterDate, formaterMontant } from '@/lib/formats';
import { jourAlger, periode } from '@/lib/rapports';
import { CATEGORIES_DEPENSE, MODES_ENCAISSEMENT, type Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

/** Dépenses du magasin. Le vendeur saisit et voit les siennes ; le propriétaire voit tout et le total du mois. */
export default async function Depenses() {
  const s = await pageUtilisateur('vendre', 'caisse');
  const t = await getTranslations('depenses');
  const td = await getTranslations('pdf');
  const langue = (await getLocale()) as Langue;
  const proprietaire = s.utilisateur.role === 'proprietaire';
  const mois = periode('mois');
  const { liste, total } = await avecCommercant(s.commercant.id, async (trx) => ({
    liste: await listerDepenses(trx, mois, proprietaire ? {} : { auteurId: s.utilisateur.id }),
    total: proprietaire ? await totalDepenses(trx, mois) : null,
  }));
  const ecrit = s.commercant.etat === 'actif';
  const select = 'min-h-12 w-full rounded-xl border border-trait bg-surface px-3 text-base text-encre';
  return (
    <>
      <EnTete titre={t('titre')} retour="/caisse" />
      <Page>
        {ecrit ? (
          <Carte className="flex flex-col gap-3">
            <h2 className="font-semibold">{t('ajouterTitre')}</h2>
            <Formulaire action={enregistrerDepense} bouton={t('ajouter')} succes={t('ajoutee')}>
              <input type="hidden" name="cle" value={randomUUID()} />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t('categorie')}</span>
                <select name="categorie" defaultValue="autre" className={select}>{CATEGORIES_DEPENSE.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</select>
              </label>
              <Champ libelle={t('montant')} name="montant" inputMode="decimal" dir="ltr" maxLength={14} required autoComplete="off" />
              <Champ libelle={t('libelle')} name="libelle" maxLength={120} autoComplete="off" aide={t('libelleAide')} />
              <div className="grid grid-cols-2 gap-3">
                <Champ libelle={t('date')} name="depenseLe" type="date" defaultValue={jourAlger()} dir="ltr" />
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t('mode')}</span>
                  <select name="mode" defaultValue="especes" className={select}>{MODES_ENCAISSEMENT.map((m) => <option key={m} value={m}>{td(`mode_${m}`)}</option>)}</select>
                </label>
              </div>
              <label className="flex min-h-12 cursor-pointer items-center gap-3">
                <input type="checkbox" name="parCaisse" defaultChecked className="size-5 accent-prim" />
                <span className="text-sm">{t('parCaisse')}</span>
              </label>
            </Formulaire>
          </Carte>
        ) : null}

        <TitreSection>{t('ceMois')}</TitreSection>
        {total ? <p className="text-sm text-doux">{t('totalMois')} <span className="font-semibold text-encre">{formaterMontant(total.total, langue)}</span></p> : null}
        {liste.length ? (
          <ul className="flex flex-col gap-2">
            {liste.map((d) => (
              <li key={d.id} className={`rounded-2xl border border-trait bg-surface shadow-doux px-4 py-3 ${d.annulee ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{t(`cat.${d.categorie}`)}{d.libelle ? ` · ${d.libelle}` : ''}</p>
                    <p className="text-sm text-doux"><span className="chiffres">{formaterDate(d.depenseLe)}</span> · {td(`mode_${d.mode}`)}{d.parCaisse ? ` · ${t('dansLaCaisse')}` : ''} · {d.auteur}</p>
                  </div>
                  <p className={`shrink-0 font-semibold ${d.annulee ? 'line-through' : ''}`}>{formaterMontant(d.montant, langue)}</p>
                </div>
                {d.annulee ? <Pastille ton="neutre">{t('annulee')}</Pastille> : ecrit && !d.caisseCloturee ? (
                  <Formulaire action={annulerDepenseAction} bouton={t('annuler')} style="secondaire">
                    <input type="hidden" name="id" value={d.id} />
                  </Formulaire>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <EtatVide titre={t('videTitre')} texte={t('videTexte')} />}
      </Page>
    </>
  );
}
