import { getLocale, getTranslations } from 'next-intl/server';
import { nomLocal } from '@/lib/formats';
import type { LigneInventaire } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';

/** Tableau des écarts d'un inventaire : compté, attendu, différence. */
export async function EcartsInventaire({ lignes }: { lignes: LigneInventaire[] }) {
  const t = await getTranslations('inventaire');
  const langue = (await getLocale()) as Langue;
  return (
    <div className="overflow-hidden rounded-xl border border-trait bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-creux text-doux">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('article')}</th>
            <th scope="col" className="px-2 py-2 text-end font-semibold">{t('compteCol')}</th>
            <th scope="col" className="px-2 py-2 text-end font-semibold">{t('attendu')}</th>
            <th scope="col" className="px-3 py-2 text-end font-semibold">{t('ecart')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-trait">
          {lignes.map((l) => {
            const ecart = l.comptee - l.theorique;
            return (
              <tr key={l.variante_id}>
                <th scope="row" className="px-3 py-2 text-start font-medium">{nomLocal(l, langue)}{l.libelle ? ` · ${l.libelle}` : ''}</th>
                <td className="px-2 py-2 text-end"><span className="chiffres">{l.comptee}</span></td>
                <td className="px-2 py-2 text-end"><span className="chiffres">{l.theorique}</span></td>
                <td className={`px-3 py-2 text-end font-bold ${ecart === 0 ? 'text-doux' : ecart > 0 ? 'text-vert' : 'text-terre'}`}>
                  <span className="chiffres">{ecart === 0 ? '0' : ecart > 0 ? `+${ecart}` : `−${-ecart}`}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
