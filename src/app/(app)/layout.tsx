import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { NavBas, type CleNav } from '@/components/NavBas';
import { Message } from '@/components/ui';
import { DROIT_MODULE, peut } from '@/lib/droits';
import { situation } from '@/lib/abonnements';
import { avecCommercant } from '@/lib/bd';
import { formaterDate } from '@/lib/formats';
import { exigerUtilisateur } from '@/lib/web';

export default async function EspaceCommercant({ children }: { children: React.ReactNode }) {
  const s = await exigerUtilisateur();
  const t = await getTranslations('accueil');
  const { role } = s.utilisateur;
  const m = s.commercant.modules;
  const visibles: CleNav[] = ['accueil', 'plus'];
  if (m.caisse && peut(role, DROIT_MODULE.caisse)) visibles.push('caisse');
  if (m.stock && peut(role, DROIT_MODULE.stock)) visibles.push('stock', 'scan');
  // Rappel de l'abonnement au propriétaire : dans les derniers jours, puis pendant le délai après la fin.
  let rappel: string | null = null;
  if (peut(role, 'reglages') && s.commercant.etat === 'actif') {
    const ab = await avecCommercant(s.commercant.id, (trx) => situation(trx, s.commercant.id));
    const date = (j: string) => formaterDate(new Date(`${j}T12:00:00Z`));
    if (ab.etat === 'bientot' && ab.fin) rappel = t('rappelBientot', { n: ab.joursRestants ?? 0, date: date(ab.fin) });
    if (ab.etat === 'delai' && ab.finDelai) rappel = t('rappelDelai', { date: date(ab.finDelai) });
  }
  return (
    <div className="pb-24 md:pb-0 md:ps-56">
      {s.commercant.etat === 'lecture_seule' ? <div className="p-3"><Message ton="info">{t('lectureSeule')}</Message></div> : null}
      {rappel ? <div className="p-3"><Link href="/reglages/abonnement" className="block"><Message ton="info">{rappel}</Message></Link></div> : null}
      {children}
      <NavBas visibles={visibles} />
    </div>
  );
}
