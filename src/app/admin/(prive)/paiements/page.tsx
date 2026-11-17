import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, EtatVide } from '@/components/ui';
import { jourAlger, listerPaiements } from '@/lib/abonnements';
import { bd } from '@/lib/bd';
import { formaterDate, formaterMontant } from '@/lib/formats';
import type { Langue } from '@/lib/types-bd';
import { exigerAdmin } from '@/lib/web';

const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
const decaler = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(a, m - 1 + n, 15));
  return d.toISOString().slice(0, 7);
};

/** Paiements reçus, mois par mois, avec le total (revenu du mois). */
export default async function Paiements({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await exigerAdmin();
  const t = await getTranslations('adminPaiements');
  const tm = await getTranslations('moyens');
  const langue = (await getLocale()) as Langue;
  const saisi = (await searchParams).mois;
  const mois = saisi && /^\d{4}-\d{2}$/.test(saisi) ? saisi : jourAlger().slice(0, 7);
  const lignes = await listerPaiements(bd('plateforme'), { mois, limite: 500 });
  const total = lignes.reduce((s, l) => s + Number(l.montant), 0);
  return (
    <>
      <EnTete admin titre={t('titre')} retour="/admin" />
      <Page>
        <nav aria-label={t('mois')} className="flex items-center justify-between gap-2">
          <Link href={`/admin/paiements?mois=${decaler(mois, -1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-trait px-3 text-sm font-semibold">{t('precedent')}</Link>
          <span className="chiffres font-semibold">{mois.slice(5)}/{mois.slice(0, 4)}</span>
          <Link href={`/admin/paiements?mois=${decaler(mois, 1)}`} className="inline-flex min-h-11 items-center rounded-lg border border-trait px-3 text-sm font-semibold">{t('suivant')}</Link>
        </nav>
        <Carte><p className="text-sm text-doux">{t('total', { n: lignes.length })}</p><p className="text-3xl font-bold">{formaterMontant(total, langue)}</p></Carte>
        {lignes.length ? (
          <ul className="flex flex-col gap-2">
            {lignes.map((l) => (
              <li key={l.id} className="rounded-xl border border-trait bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/commercants/${l.commercant_id}`} className="min-w-0 font-semibold underline">{l.commercant}</Link>
                  <span className="shrink-0 font-bold">{formaterMontant(BigInt(l.montant), langue)}</span>
                </div>
                <p className="text-sm text-doux">{date(l.recu_le)} · {tm(l.moyen)}{l.reference ? ` · ${l.reference}` : ''} · {l.formule}</p>
                {l.debut && l.fin ? <p className="text-sm text-doux">{t('periode', { du: date(l.debut), au: date(l.fin) })}</p> : null}
              </li>
            ))}
          </ul>
        ) : <EtatVide titre={t('videTitre')} texte={t('videTexte')} />}
      </Page>
    </>
  );
}
