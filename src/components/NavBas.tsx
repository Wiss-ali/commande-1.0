'use client';
// Navigation principale : barre en bas sur téléphone (Scan au centre), colonne sur le côté sur grand écran.
import { Calculator, House, Menu, Package, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ENTREES = [
  { cle: 'accueil', href: '/', Icone: House },
  { cle: 'caisse', href: '/caisse', Icone: Calculator },
  { cle: 'scan', href: '/scan', Icone: ScanLine },
  { cle: 'stock', href: '/stock', Icone: Package },
  { cle: 'plus', href: '/plus', Icone: Menu },
] as const;
export type CleNav = (typeof ENTREES)[number]['cle'];

export function NavBas({ visibles }: { visibles: CleNav[] }) {
  const t = useTranslations('nav');
  const chemin = usePathname();
  const actif = (href: string) => (href === '/' ? chemin === '/' : chemin.startsWith(href));
  // « Plus » reste allumé pour les pages qui n'ont pas d'entrée propre.
  const aucun = !ENTREES.some((e) => e.cle !== 'plus' && visibles.includes(e.cle) && actif(e.href));
  return (
    <nav aria-label={t('principale')} className="fixed inset-x-0 bottom-0 z-20 border-t border-trait bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:inset-x-auto md:inset-y-0 md:start-0 md:w-60 md:border-e md:border-t-0 md:bg-surface md:pt-4">
      <ul className="flex md:flex-col md:gap-1 md:px-3">
        {ENTREES.filter((e) => visibles.includes(e.cle)).map(({ cle, href, Icone }) => {
          const ici = cle === 'plus' ? aucun : actif(href);
          const scan = cle === 'scan';
          return (
            <li key={cle} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={ici ? 'page' : undefined}
                className={`group flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-sm ${ici ? 'font-semibold text-prim md:bg-prim-pale' : 'font-medium text-doux hover:text-encre'}`}
              >
                <span className={scan ? '-mt-7 flex size-14 items-center justify-center rounded-2xl bg-prim text-sur-prim shadow-prim ring-4 ring-fond md:mt-0 md:size-auto md:bg-transparent md:text-current md:shadow-none md:ring-0' : `flex h-8 w-14 items-center justify-center rounded-full md:h-auto md:w-auto ${ici ? 'bg-prim-pale md:bg-transparent' : ''}`}>
                  <Icone aria-hidden className={scan ? 'size-7 md:size-5' : 'size-5'} />
                </span>
                {t(cle)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
