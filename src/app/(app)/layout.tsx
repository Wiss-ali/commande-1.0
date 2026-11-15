import { getTranslations } from 'next-intl/server';
import { NavBas, type CleNav } from '@/components/NavBas';
import { Message } from '@/components/ui';
import { DROIT_MODULE, peut } from '@/lib/droits';
import { exigerUtilisateur } from '@/lib/web';

export default async function EspaceCommercant({ children }: { children: React.ReactNode }) {
  const s = await exigerUtilisateur();
  const t = await getTranslations('accueil');
  const { role } = s.utilisateur;
  const m = s.commercant.modules;
  const visibles: CleNav[] = ['accueil', 'plus'];
  if (m.caisse && peut(role, DROIT_MODULE.caisse)) visibles.push('caisse');
  if (m.stock && peut(role, DROIT_MODULE.stock)) visibles.push('stock', 'scan');
  return (
    <div className="pb-24 md:pb-0 md:ps-56">
      {s.commercant.etat === 'lecture_seule' ? <div className="p-3"><Message ton="info">{t('lectureSeule')}</Message></div> : null}
      {children}
      <NavBas visibles={visibles} />
    </div>
  );
}
