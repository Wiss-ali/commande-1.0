import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EnTete } from '@/components/EnTete';
import { ListeMouvements } from '@/components/ListeMouvements';
import { Page } from '@/components/Page';
import { classeBouton, EtatVide } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { listerMouvements } from '@/lib/stock';
import type { TypeMouvement } from '@/lib/types-bd';
import { pageUtilisateur } from '@/lib/web';

const PAR_PAGE = 40;
const TYPES: readonly TypeMouvement[] = ['entree', 'vente', 'retour', 'correction'];
const UUID = /^[0-9a-f-]{36}$/i;

export default async function Mouvements({ searchParams }: { searchParams: Promise<{ type?: string; produit?: string; page?: string }> }) {
  const s = await pageUtilisateur('preparer', 'stock');
  const t = await getTranslations('mouvement');
  const params = await searchParams;
  const type = TYPES.find((x) => x === params.type);
  const produitId = params.produit && UUID.test(params.produit) ? params.produit : undefined;
  const page = Math.min(Math.max(Number(params.page) || 1, 1), 100);
  const mouvements = await avecCommercant(s.commercant.id, (trx) => listerMouvements(trx, { type, produitId, limite: PAR_PAGE * page + 1 }));
  const adresse = (plus: { type?: string; page?: number }) => {
    const p = new URLSearchParams({ ...(produitId ? { produit: produitId } : {}), ...(plus.type ? { type: plus.type } : {}), ...(plus.page ? { page: String(plus.page) } : {}) });
    const texte = p.toString();
    return texte ? `/stock/mouvements?${texte}` : '/stock/mouvements';
  };
  return (
    <>
      <EnTete titre={t('titre')} retour={produitId ? `/stock/${produitId}` : '/stock'} />
      <Page>
        <nav aria-label={t('filtres')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[undefined, ...TYPES].map((x) => (
            <Link key={x ?? 'tous'} href={adresse({ type: x })} aria-current={x === type ? 'true' : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${x === type ? 'border-vert bg-vert-pale text-vert' : 'border-trait bg-surface'}`}>
              {x ? t(`type.${x}`) : t('tous')}
            </Link>
          ))}
        </nav>
        {mouvements.length ? <ListeMouvements mouvements={mouvements.slice(0, PAR_PAGE * page)} avecProduit={!produitId} /> : <EtatVide titre={t('videTitre')} texte={t('videTexte')} />}
        {mouvements.length > PAR_PAGE * page ? <Link href={adresse({ type, page: page + 1 })} scroll={false} className={classeBouton.secondaire}>{t('voirPlus')}</Link> : null}
      </Page>
    </>
  );
}
