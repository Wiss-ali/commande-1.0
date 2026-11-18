'use client';
// Navigation principale : barre en bas sur téléphone (4 entrées choisies par chaque personne, puis « Plus »),
// colonne sur le côté sur grand écran. Sur grand écran, la colonne montre aussi les autres modules et les
// réglages (sur téléphone, ils sont dans « Plus »). Scan garde sa forme mise en avant, où qu'il soit.
import { House, Menu, ScanLine, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { lienEntree, type EntreeBarre } from '@/lib/barre';
import { ICONE_MODULE } from '@/lib/icones-modules';
import type { NomModule } from '@/lib/types-bd';

const ACTIF = 'font-semibold text-prim md:bg-prim-pale';
const INACTIF = 'font-medium text-doux hover:text-encre';
// « Plus » allumé sur téléphone seulement (la page a sa propre entrée dans la colonne du grand écran).
const ACTIF_TELEPHONE = 'font-semibold text-prim md:font-medium md:text-doux md:hover:text-encre';
const icone = (e: EntreeBarre) => (e === 'accueil' ? House : e === 'scan' ? ScanLine : ICONE_MODULE[e]);

export function NavBas({ barre, modules, reglages }: { barre: EntreeBarre[]; modules: NomModule[]; reglages: string }) {
  const t = useTranslations('nav');
  const tm = useTranslations('modules');
  const tp = useTranslations('plus');
  const chemin = usePathname();
  const actif = (href: string) => (href === '/' ? chemin === '/' : chemin === href || chemin.startsWith(`${href}/`));
  // « Plus » reste allumé pour les pages qui n'ont pas d'entrée propre.
  const aucun = !barre.some((e) => actif(lienEntree(e)));
  const extras = [
    ...modules.map((m) => ({ cle: m, href: `/${m}`, titre: tm(m), Icone: ICONE_MODULE[m] })),
    { cle: 'reglages', href: reglages, titre: tp('reglages'), Icone: Settings },
  ];
  const extraActif = extras.some((e) => actif(e.href === '/reglages/securite' ? '/reglages' : e.href));
  const entree = (cle: string, href: string, Icone: typeof House, titre: string, ici: boolean, style: string) => {
    const scan = cle === 'scan';
    return (
      <li key={cle} className="flex-1 md:flex-none">
        <Link
          href={href}
          aria-current={ici ? 'page' : undefined}
          className={`group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${style}`}
        >
          <span className={scan ? '-mt-7 flex size-14 items-center justify-center rounded-2xl bg-prim text-sur-prim shadow-prim ring-4 ring-fond md:mt-0 md:size-auto md:bg-transparent md:text-current md:shadow-none md:ring-0' : `flex h-8 w-14 items-center justify-center rounded-full md:h-auto md:w-auto ${ici ? 'bg-prim-pale md:bg-transparent' : ''}`}>
            <Icone aria-hidden className={scan ? 'size-7 md:size-5' : 'size-5'} />
          </span>
          <span className="max-w-full truncate px-0.5">{titre}</span>
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label={t('principale')} className="fixed inset-x-0 bottom-0 z-20 border-t border-trait bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:inset-x-auto md:inset-y-0 md:start-0 md:w-60 md:overflow-y-auto md:border-e md:border-t-0 md:bg-surface md:pt-4">
      <ul className="flex md:flex-col md:gap-1 md:px-3">
        {barre.map((e) => {
          const href = lienEntree(e);
          const ici = actif(href);
          return entree(e, href, icone(e), t.has(e) ? t(e) : tm(e), ici, ici ? ACTIF : INACTIF);
        })}
        {/* Grand écran : les autres modules et les réglages, juste avant « Plus ». */}
        {extras.map((e) => {
          const iciExtra = actif(e.href === '/reglages/securite' ? '/reglages' : e.href);
          return (
            <li key={e.cle} className="hidden md:block">
              <Link href={e.href} aria-current={iciExtra ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${iciExtra ? ACTIF : INACTIF}`}>
                <e.Icone aria-hidden className="size-5" />
                {e.titre}
              </Link>
            </li>
          );
        })}
        {entree('plus', '/plus', Menu, t('plus'), aucun, !aucun ? INACTIF : extraActif ? ACTIF_TELEPHONE : ACTIF)}
      </ul>
    </nav>
  );
}
