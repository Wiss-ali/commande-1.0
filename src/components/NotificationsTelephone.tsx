'use client';
// Active les notifications sur ce téléphone : autorisation demandée après un toucher (exigé par iPhone),
// abonnement du navigateur avec la clé publique du serveur, puis enregistrement côté serveur.
import { BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { abonnerTelephone, desabonnerTelephone } from '@/app/actions/boutique';
import { classeBouton, Message } from './ui';

type Etat = 'inconnu' | 'impossible' | 'installer' | 'refuse' | 'actif' | 'inactif';

const versOctets = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

export function NotificationsTelephone({ clePublique }: { clePublique: string | null }) {
  const t = useTranslations('notifications');
  const [etat, setEtat] = useState<Etat>('inconnu');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      if (!clePublique) return setEtat('impossible');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        // Sur iPhone, les notifications n'existent que pour l'application installée sur l'écran d'accueil.
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        return setEtat(ios ? 'installer' : 'impossible');
      }
      if (Notification.permission === 'denied') return setEtat('refuse');
      const enregistrement = await navigator.serviceWorker.register('/sw.js');
      const abonnement = await enregistrement.pushManager.getSubscription();
      setEtat(abonnement ? 'actif' : 'inactif');
    })().catch(() => setEtat('impossible'));
  }, [clePublique]);

  async function activer() {
    if (!clePublique) return;
    setEnCours(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setEtat('refuse');
      const enregistrement = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(clePublique) });
      setEtat((await abonnerTelephone(abonnement.toJSON())) ? 'actif' : 'impossible');
    } catch {
      setEtat('impossible');
    } finally {
      setEnCours(false);
    }
  }

  async function desactiver() {
    setEnCours(true);
    try {
      const abonnement = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (abonnement) {
        await desabonnerTelephone(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat('inactif');
    } finally {
      setEnCours(false);
    }
  }

  if (etat === 'inconnu') return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 font-semibold"><BellRing aria-hidden className="size-5 text-vert" />{t('telephoneTitre')}</p>
      {etat === 'actif' ? <><Message ton="succes">{t('telephoneActif')}</Message><button type="button" onClick={desactiver} disabled={enCours} className={classeBouton.secondaire}>{t('desactiver')}</button></> : null}
      {etat === 'inactif' ? <><p className="text-sm text-doux">{t('telephoneTexte')}</p><button type="button" onClick={activer} disabled={enCours} className={classeBouton.principal}>{t('activer')}</button></> : null}
      {etat === 'installer' ? <Message ton="info">{t('installerIphone')}</Message> : null}
      {etat === 'refuse' ? <Message ton="info">{t('refuse')}</Message> : null}
      {etat === 'impossible' ? <p className="text-sm text-doux">{t('impossible')}</p> : null}
    </div>
  );
}
