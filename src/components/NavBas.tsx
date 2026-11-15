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
    <nav aria-label={t('principale')} className="fixed inset-x-0 bottom-0 z-20 border-t border-trait bg-surface pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:inset-y-0 md:start-0 md:w-56 md:border-e md:border-t-0 md:pt-4">
      <ul className="flex md:flex-col md:gap-1 md:px-3">
        {ENTREES.filter((e) => visibles.includes(e.cle)).map(({ cle, href, Icone }) => {
          const ici = cle === 'plus' ? aucun : actif(href);
          const scan = cle === 'scan';
          return (
            <li key={cle} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={ici ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs md:min-h-12 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-sm ${ici ? 'font-bold text-vert md:bg-vert-pale' : 'font-medium text-doux'}`}
              >
                <span className={scan ? '-mt-6 flex size-14 items-center justify-center rounded-full bg-vert text-sur-vert ring-4 ring-surface md:mt-0 md:size-auto md:bg-transparent md:text-current md:ring-0' : ''}>
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
