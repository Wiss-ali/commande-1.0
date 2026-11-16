import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EcartsInventaire } from '@/components/EcartsInventaire';
import { EnTete } from '@/components/EnTete';
import { Page } from '@/components/Page';
import { Carte, Message, Pastille } from '@/components/ui';
import { avecCommercant } from '@/lib/bd';
import { formaterDate, formaterHeure } from '@/lib/formats';
import { lignesInventaire } from '@/lib/stock';
import { pageUtilisateur } from '@/lib/web';

const UUID = /^[0-9a-f-]{36}$/i;

export default async function InventairePasse({ params }: { params: Promise<{ id: string }> }) {
  const s = await pageUtilisateur('preparer', 'stock');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = await getTranslations('inventaire');
  const { inventaire, lignes } = await avecCommercant(s.commercant.id, async (trx) => ({
    inventaire: await trx.selectFrom('inventaires as i').innerJoin('utilisateurs as u', 'u.id', 'i.cree_par').leftJoin('utilisateurs as f', 'f.id', 'i.termine_par')
      .select(['i.etat', 'i.cree_le', 'i.termine_le', 'u.nom as ouvert_par', 'f.nom as termine_par']).where('i.id', '=', id).executeTakeFirst(),
    lignes: await lignesInventaire(trx, id),
  }));
  if (!inventaire || inventaire.etat === 'en_cours') notFound();
  const corrections = lignes.filter((l) => l.comptee !== l.theorique).length;
  return (
    <>
      <EnTete titre={t('detailTitre', { date: formaterDate(inventaire.termine_le ?? inventaire.cree_le) })} retour="/stock/inventaire" />
      <Page>
        <Carte className="flex flex-col gap-2 text-sm">
          <p><Pastille ton={inventaire.etat === 'valide' ? 'vert' : 'neutre'}>{t(inventaire.etat === 'valide' ? 'etatValide' : 'etatAnnule')}</Pastille></p>
          <p>{t('ouvertPar', { nom: inventaire.ouvert_par })}</p>
          {inventaire.termine_le ? <p>{t('terminePar', { nom: inventaire.termine_par ?? '' })} · <span className="chiffres">{formaterDate(inventaire.termine_le)} {formaterHeure(inventaire.termine_le)}</span></p> : null}
        </Carte>
        {inventaire.etat === 'valide' ? <Message ton="succes">{t('bilan', { articles: lignes.length, n: corrections })}</Message> : <Message ton="info">{t('annuleTexte')}</Message>}
        {lignes.length ? <EcartsInventaire lignes={lignes} /> : null}
      </Page>
    </>
  );
}
