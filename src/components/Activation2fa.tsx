'use client';
// Activation de la double authentification en deux temps : afficher le QR code, puis confirmer par un code.
import { useTranslations } from 'next-intl';
import { useActionState, startTransition } from 'react';
import type { Etat } from '@/lib/etat';
import { Champ, classeBouton, Message } from './ui';

type Action = (etat: Etat, f: FormData) => Promise<Etat>;

export function Activation2fa({ preparer, activer, suite }: { preparer: Action; activer: Action; suite?: { href: string; libelle: string } }) {
  const t = useTranslations();
  const [prepare, lancer, attente1] = useActionState(preparer, {});
  const [active, confirmer, attente2] = useActionState(activer, {});

  if (active.codes) {
    return (
      <div className="flex flex-col gap-3">
        <Message ton="succes">{t('securite.a2fActive')}</Message>
        <p className="font-semibold">{t('securite.codesTitre')}</p>
        <p className="text-sm text-doux">{t('securite.codesTexte')}</p>
        <ul dir="ltr" className="grid grid-cols-2 gap-2 rounded-lg bg-creux p-3 font-mono text-sm">
          {active.codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {suite ? <a href={suite.href} className={classeBouton.principal}>{suite.libelle}</a> : null}
      </div>
    );
  }
  if (!prepare.qr) {
    return (
      <form action={lancer} className="flex flex-col gap-3">
        {prepare.erreur ? <Message ton="erreur">{t(`erreurs.${prepare.erreur}`)}</Message> : null}
        <button type="submit" disabled={attente1} className={classeBouton.principal}>{attente1 ? t('commun.patienter') : t('securite.a2fActiver')}</button>
      </form>
    );
  }
  return (
    <form
      action={confirmer}
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        startTransition(() => confirmer(d));
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm">{t('securite.a2fScanner')}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={prepare.qr} alt="" width={200} height={200} className="self-center rounded-lg bg-white p-1" />
      <p className="text-sm text-doux">
        {t('securite.a2fCle')} <code dir="ltr" className="break-all font-mono text-encre">{prepare.cle}</code>
      </p>
      <Champ libelle={t('securite.a2fCode')} name="code" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required />
      {active.erreur ? <Message ton="erreur">{t(`erreurs.${active.erreur}`)}</Message> : null}
      <button type="submit" disabled={attente2} className={classeBouton.principal}>{attente2 ? t('commun.patienter') : t('securite.a2fConfirmer')}</button>
    </form>
  );
}
