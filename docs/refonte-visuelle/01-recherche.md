# Refonte visuelle — recherche (18/11/2026)

Demande du propriétaire, après le premier essai sur le serveur : « un design un peu vieux, même les couleurs ».
Il souhaite **du blanc, des contours fins bleus**, et un **mode sombre plus stylé**.

## Ce que disent les sources

- **Le calme et l'espace.** Les tableaux de bord récents (Linear, par exemple) affichent peu d'éléments décoratifs
  et beaucoup d'espace : le travail passe au premier plan. Des écrans modulaires, qui montrent le détail seulement quand on le demande.
  Sources : [saasui.design — 7 SaaS UI design trends 2026](https://saasui.design/blog/7-saas-ui-design-trends-2026),
  [SaaSFrame — SaaS Dashboard Design 2026](https://www.saasframe.io/blog/the-anatomy-of-high-performance-saas-dashboard-design-2026-trends-patterns),
  [DEV — SaaS dashboard design trends in 2026](https://dev.to/thekitbase/saas-dashboard-design-trends-in-2026-with-examples-121m).
- **Le mode sombre.** Le consensus : pas de noir pur, plutôt un **bleu nuit / ardoise** (de l'ordre de `#0f172a`).
  Des surfaces de plus en plus claires pour marquer la profondeur (au lieu des ombres), un texte blanc cassé et une seule couleur d'accent, adoucie.
  Sources : [saasui.design — dark mode patterns](https://www.saasui.design/blog/saas-dark-mode-theming-ux-patterns),
  [uxmagic — dark mode UI design guide](https://uxmagic.ai/blog/dark-mode-ui-design-guide),
  [Color Archive — fintech dark mode colors](https://color-archive.vercel.app/guides/fintech-dark-mode-colors/),
  [Inkbot — Dark mode best practices](https://inkbotdesign.com/dark-mode/).
- **La police arabe.** IBM Plex Sans Arabic est conçue pour les interfaces : on la garde.
  Readex Pro est une alternative lisible ; aucune comparaison directe n'a été trouvée.
  Sources : [Google Fonts — IBM Plex Sans Arabic](https://fonts.google.com/specimen/IBM+Plex+Sans+Arabic/about),
  [Material Design — Readex Pro](https://material.io/blog/readex-pro-legibility-arabic-type-design).
- **La police latine.** Inter est la police d'interface la plus répandue aujourd'hui. Elle est très lisible en petit et ses chiffres sont alignés (montants).
  Elle est disponible hors ligne par Fontsource : aucun appel à Google, la politique de sécurité (CSP) ne change pas.
- Remarque : ces sources sont surtout des blogs d'agences. Elles donnent des tendances, pas des normes.

## Liste

**Indispensable (fait)**
- Couleur principale **bleue** (`#2563eb` en clair, `#60a5fa` en sombre), contraste suffisant pour l'accessibilité (WCAG AA).
- Fond **blanc** et **contours fins bleutés** sur les cartes, champs et boutons.
- **Vert réservé aux bonnes nouvelles** (payé, en stock, +), orange pour « à surveiller », rouge pour les erreurs : la signification des couleurs ne change pas.
- Mode sombre **bleu nuit** (pas de noir pur), surfaces étagées, texte blanc cassé.
- Police **Inter** (latin) avec IBM Plex Sans Arabic (arabe), toutes deux servies par l'application elle-même.
- Coins plus arrondis, ombres très légères, en-tête légèrement transparent, barre du bas plus fine avec un indicateur pour la page en cours.
- Icône de l'application, couleur du navigateur sur téléphone et PDF (factures, tickets) passés au bleu.

**Utile (plus tard)**
- Choix de la couleur d'accent par le commerçant dans l'espace de gestion (aujourd'hui seulement pour sa boutique).
- Petites animations d'apparition (respectant « réduire les animations »).

**Plus tard**
- Thème « contraste élevé ».
- Illustrations pour les écrans vides.

La boutique en ligne garde la couleur choisie par chaque commerçant (6 couleurs).
