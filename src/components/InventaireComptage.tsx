'use client';
// Comptage d'un inventaire : chaque scan ajoute 1 à l'article ; on peut aussi chercher par nom
// et corriger une quantité à la main.
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { chercherTexte, compterArticle, retirerLigne, type ArticleScan } from '@/app/actions/stock';
import { nomLocal } from '@/lib/formats';
import type { LigneInventaire } from '@/lib/stock';
import type { Langue } from '@/lib/types-bd';
import { Scanner } from './Scanner';
import { classeBouton, Message, TitreSection } from './ui';

type Retour = { ton: 'succes'; texte: string } | { ton: 'erreur'; texte: string } | null;

export function InventaireComptage({ inventaireId, lignes }: { inventaireId: string; lignes: LigneInventaire[] }) {
  const t = useTranslations('inventaire');
  const te = useTranslations('erreurs');
  const langue = useLocale() as Langue;
  const routeur = useRouter();
  const [retour, setRetour] = useState<Retour>(null);
  const [recherche, setRecherche] = useState('');
  const [trouves, setTrouves] = useState<ArticleScan[] | null>(null);
  const [, transition] = useTransition();

  const libelle = (a: { nom_fr: string; nom_ar: string; libelle: string }) => `${nomLocal(a, langue)}${a.libelle ? ` · ${a.libelle}` : ''}`;

  const compter = useCallback(
    async (cible: { code: string } | { varianteId: string }, mode: 'ajouter' | 'fixer', n: number) => {
      try {
        const r = await compterArticle(inventaireId, cible, mode, n);
        if (r.ok) setRetour({ ton: 'succes', texte: t('compte', { article: `${nomLocal(r.article, langue)}${r.article.libelle ? ` · ${r.article.libelle}` : ''}`, n: r.comptee }) });
        else setRetour({ ton: 'erreur', texte: r.raison === 'code_inconnu' && 'code' in cible ? t('codeInconnu', { code: cible.code }) : te(r.raison) });
        transition(() => routeur.refresh());
      } catch {
        setRetour({ ton: 'erreur', texte: te('inconnue') });
      }
    },
    [inventaireId, langue, routeur, t, te],
  );
  const surCode = useCallback((code: string) => void compter({ code }, 'ajouter', 1), [compter]);

  return (
    <>
      <Scanner onCode={surCode} />
      <div aria-live="polite">{retour ? <Message ton={retour.ton}>{retour.texte}</Message> : null}</div>

      <form
        role="search"
        className="flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setTrouves(recherche.trim() ? await chercherTexte(recherche) : null);
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">{t('chercher')}</span>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} type="search" maxLength={80} className="min-h-12 w-full rounded-lg border border-trait bg-surface px-3 text-base text-encre" />
        </label>
        <button type="submit" aria-label={t('chercher')} className={`${classeBouton.secondaire} min-h-12 px-3`}><Search aria-hidden className="size-5" /></button>
      </form>
      {trouves ? (
        trouves.length ? (
          <ul className="flex flex-col gap-2">
            {trouves.map((a) => (
              <li key={a.varianteId} className="flex items-center gap-3 rounded-xl border border-trait bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{libelle(a)}</span>
                <button type="button" onClick={() => void compter({ varianteId: a.varianteId }, 'ajouter', 1)} className={classeBouton.secondaire}><Plus aria-hidden className="size-4" />{t('compterUn')}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-doux">{t('rienTrouve')}</p>
        )
      ) : null}

      <TitreSection>{t('comptes', { n: lignes.length })}</TitreSection>
      {lignes.length ? (
        <ul className="flex flex-col gap-2">
          {lignes.map((l) => (
            <li key={l.variante_id} className="flex items-center gap-2 rounded-xl border border-trait bg-surface px-3 py-2">
              <span className="min-w-0 flex-1 text-sm font-semibold">{libelle(l)}</span>
              <button type="button" disabled={l.comptee === 0} onClick={() => void compter({ varianteId: l.variante_id }, 'fixer', l.comptee - 1)} aria-label={t('moins')} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-trait disabled:opacity-40"><Minus aria-hidden className="size-4" /></button>
              <input
                key={l.comptee}
                defaultValue={l.comptee}
                aria-label={t('quantite', { article: libelle(l) })}
                inputMode="numeric"
                dir="ltr"
                maxLength={7}
                onBlur={(e) => {
                  const n = Number(e.target.value.trim());
                  if (Number.isInteger(n) && n >= 0 && n !== l.comptee) void compter({ varianteId: l.variante_id }, 'fixer', n);
                  else e.target.value = String(l.comptee);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="chiffres min-h-11 w-16 shrink-0 rounded-lg border border-trait bg-surface px-1 text-center text-lg font-bold"
              />
              <button type="button" onClick={() => void compter({ varianteId: l.variante_id }, 'ajouter', 1)} aria-label={t('plus')} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-trait"><Plus aria-hidden className="size-4" /></button>
              <form action={retirerLigne}>
                <input type="hidden" name="inventaire" value={inventaireId} />
                <input type="hidden" name="variante" value={l.variante_id} />
                <button type="submit" aria-label={t('retirer')} className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-terre"><Trash2 aria-hidden className="size-4" /></button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-doux">{t('aucunCompte')}</p>
      )}
    </>
  );
}
