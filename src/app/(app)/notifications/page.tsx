import { getLocale, getTranslations } from 'next-intl/server';
import { notificationsVues, ouvrirUneNotification } from '@/app/actions/boutique';
import { EnTete } from '@/components/EnTete';
import { NotificationsTelephone } from '@/components/NotificationsTelephone';
import { Page } from '@/components/Page';
import { PastilleCommande } from '@/components/PastilleCommande';
import { Carte, classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerNotifications } from '@/lib/boutique';
import { formaterDate, formaterHeure, formaterMontant } from '@/lib/formats';
import { clesVapid } from '@/lib/notifier';
import type { Langue } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

export default async function Notifications() {
  const s = await pageUtilisateur('vendre', 'commandes');
  const t = await getTranslations('notifications');
  const langue = (await getLocale()) as Langue;
  const liste = await avecCommercant(s.commercant.id, (trx) => listerNotifications(trx, s.utilisateur.id));
  const nouvelles = liste.filter((n) => n.nouvelle).length;
  return (
    <>
      <EnTete titre={t('titre')} retour="/" />
      <Page>
        <Carte><NotificationsTelephone clePublique={clesVapid()?.publique ?? null} /></Carte>
        {nouvelles ? (
          <form action={notificationsVues}>
            <button type="submit" className={`${classeBouton.secondaire} w-full`}>{t('toutVu')}</button>
          </form>
        ) : null}
        {liste.length ? (
          <ul className="flex flex-col gap-2">
            {liste.map((n) => (
              <li key={n.id}>
                <form action={ouvrirUneNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-start shadow-doux hover:border-trait-fort ${n.nouvelle ? 'border-safran/60' : 'border-trait opacity-80'}`}>
                  {n.nouvelle ? <span aria-label={t('nouvelle')} className="size-2.5 shrink-0 rotate-45 bg-safran" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t('commandeBoutique', { n: n.numero })}</span>
                    <span className="block truncate text-sm text-doux">{n.nom} · <span className="chiffres">{formaterDate(n.cree_le)} {formaterHeure(n.cree_le)}</span></span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold">{formaterMontant(BigInt(n.total), langue)}</span>
                    <PastilleCommande statut={n.statut} />
                  </span>
                </button>
                </form>
              </li>
            ))}
          </ul>
        ) : <EtatVide titre={t('videTitre')} texte={t('videTexte')} />}
      </Page>
    </>
  );
}
