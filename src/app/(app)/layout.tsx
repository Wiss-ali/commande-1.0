import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NavBas } from '@/components/NavBas';
import { barreDe, entreesDisponibles } from '@/lib/barre';
import { Message } from '@/components/ui';
import { DROIT_MODULE, MODULES, peut } from '@/lib/droits';
import { situation } from '@/lib/abonnements';
import { avecCommercant } from '@/lib/bd';
import { formaterDate } from '@/lib/formats';
import { exigerUtilisateur } from '@/lib/web';

export default async function EspaceCommercant({ children }: { children: React.ReactNode }) {
  const s = await exigerUtilisateur();
  const t = await getTranslations('accueil');
  const { role } = s.utilisateur;
  const m = s.commercant.modules;
  // Barre du bas : les 4 entrées choisies par la personne (Réglages › Barre du bas), sinon celles par défaut.
  const barre = barreDe(s.utilisateur.barreBas, entreesDisponibles(role, m));
  // Grand écran : les autres modules (comme dans « Plus ») s'affichent aussi dans la colonne de gauche.
  const autres = MODULES.filter((n) => !barre.includes(n) && m[n] && peut(role, DROIT_MODULE[n]));
  const reglages = peut(role, 'reglages') ? '/reglages' : '/reglages/securite';
  // Rappel de l'abonnement au propriétaire : dans les derniers jours, puis pendant le délai après la fin.
  let rappel: string | null = null;
  if (peut(role, 'reglages') && s.commercant.etat === 'actif') {
    const ab = await avecCommercant(s.commercant.id, (trx) => situation(trx, s.commercant.id));
    const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
    if (ab.etat === 'bientot' && ab.fin) rappel = t('rappelBientot', { n: ab.joursRestants ?? 0, date: date(ab.fin) });
    if (ab.etat === 'delai' && ab.finDelai) rappel = t('rappelDelai', { date: date(ab.finDelai) });
  }
  return (
    <div className="pb-24 md:pb-0 md:ps-60">
      {/* Boutique de démonstration de l'administrateur : données fictives, retour à l'administration d'un toucher. */}
      {s.commercant.demo ? (
        <p role="status" className="flex flex-wrap items-center justify-center gap-x-3 bg-safran px-4 py-2 text-center text-sm font-semibold text-encre">
          {t('demoBandeau')}
          <a href="/admin" className="underline">{t('demoRetour')}</a>
        </p>
      ) : null}
      {s.commercant.etat === 'lecture_seule' ? <div className="p-3"><Message ton="info">{t('lectureSeule')}</Message></div> : null}
      {rappel ? <div className="p-3"><Link href="/reglages/abonnement" className="block"><Message ton="info">{rappel}</Message></Link></div> : null}
      {children}
      <NavBas barre={barre} modules={autres} reglages={reglages} />
    </div>
  );
}
