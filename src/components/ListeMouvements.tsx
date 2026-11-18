import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { formaterDate, formaterHeure, nomLocal } from '@/lib/formats';
import type { LigneMouvement } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';

/** Historique des mouvements : quoi, combien, par qui, quand, et le stock obtenu. */
export async function ListeMouvements({ mouvements, avecProduit }: { mouvements: LigneMouvement[]; avecProduit?: boolean }) {
  const t = await getTranslations('mouvement');
  const langue = (await getLocale()) as Langue;
  return (
    <ul className="flex flex-col divide-y divide-trait rounded-2xl border border-trait bg-surface shadow-doux">
      {mouvements.map((m) => {
        const reserve = m.type === 'reservation' || m.type === 'liberation';
        return (
          <li key={m.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`chiffres min-w-12 text-lg font-bold ${m.quantite > 0 ? 'text-ok' : 'text-terre'}`}>{m.quantite > 0 ? `+${m.quantite}` : `−${Math.abs(m.quantite)}`}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {t(`type.${m.type}`)}
                {m.motif ? ` · ${t(`motif.${m.motif}`)}` : ''}
              </p>
              {avecProduit ? (
                <Link href={`/stock/${m.produit_id}`} className="block truncate text-ok underline">{nomLocal(m, langue)}{m.libelle ? ` · ${m.libelle}` : ''}</Link>
              ) : m.libelle ? <p>{m.libelle}</p> : null}
              {m.note ? <p className="text-doux">{m.note}</p> : null}
              <p className="text-doux">
                {m.auteur} · <span className="chiffres">{formaterDate(m.cree_le)} {formaterHeure(m.cree_le)}</span>
                {reserve ? '' : <> · {t('stockApres')} <span className="chiffres font-semibold text-encre">{m.stock_apres}</span></>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
