// Service de l'application installée : affiche les notifications envoyées par le serveur (Web Push)
// et ouvre la commande concernée quand on touche la notification. Ne garde rien en cache.
self.addEventListener('push', (evenement) => {
  let message = { titre: 'Hanout', texte: '', url: '/' };
  try {
    message = { ...message, ...evenement.data.json() };
  } catch {
    // Message illisible : notification générique.
  }
  evenement.waitUntil(self.registration.showNotification(message.titre, { body: message.texte, icon: '/icones/icone-192.png', badge: '/icones/icone-192.png', data: { url: message.url }, tag: message.url }));
});

self.addEventListener('notificationclick', (evenement) => {
  evenement.notification.close();
  // Seulement une adresse de l'application elle-même.
  const url = new URL(evenement.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  evenement.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) {
      if ('focus' in f) {
        await f.focus();
        if ('navigate' in f) return f.navigate(url.href);
        return;
      }
    }
    return self.clients.openWindow(url.href);
  })());
});
