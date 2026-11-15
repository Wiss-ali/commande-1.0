# Étape 0 — Compte rendu de recherche

Recherche faite le 15/11/2026. Les sites officiels `commerce.gov.dz`, `legal-doctrine.com` et
`cheatsheetseries.owasp.org` n'étaient pas joignables depuis cette session : les points concernés
viennent de sources secondaires et sont marqués **à vérifier**. Rien de ce qui suit ne sera écrit
en dur : chaque taux, mention ou durée est un réglage.

## 1. Wilayas

- L'Algérie compte bien **69 wilayas** : 11 nouvelles ont été créées (annonce de novembre 2025, loi promulguée en avril 2026, Journal officiel n° 25), avec 1 541 communes. Les nouvelles portent les numéros 59 à 69 : Aflou, Barika, El Kantara, Bir El Ater, El Aricha, Ksar Chellala, Aïn Oussara, Messaad, Ksar El Boukhari, Bou Saâda, El Abiodh Sidi Cheikh.
- **À vérifier** : l'ordre exact des numéros 59 à 69 et le rattachement de chaque commune. Les jeux de données libres ne sont pas tous d'accord (1 528 ou 1 541 communes).
- Conséquence : wilayas et communes sont des tables modifiables par l'administrateur, chargées depuis un fichier de départ que vous pourrez corriger.

Sources : [Algérie360 – 69 wilayas](https://www.algerie360.com/organisation-territoriale-lalgerie-passe-officiellement-a-69-wilayas/), [TSA – liste des 11 wilayas](https://www.tsa-algerie.com/algerie-onze-nouvelles-wilayas-creees-voici-la-liste/), [Algérie360 – numéros 59 à 69](https://www.algerie360.com/59-a-60-b-decouverez-les-matricules-officielles-des-11-nouvelles-wilayas/), [ConformePro – JO 2026 n° 25](https://www.conformepro.dz/resources/joradp-sgg-algerie/journal-officiel-algerien-2026-25-التقسيم-الإقليمي-الجديد-للبلاد-بـ-69-ولاية-وقرارات-تنظيمية-أخرى)

## 2. Factures et documents commerciaux

- Le texte de référence est le **décret exécutif 05-468 du 10/12/2005**. Il couvre quatre documents : la facture, le **bon de transfert**, le bon de livraison et la **facture récapitulative**.
- Mentions citées par les sources : identité du vendeur (nom et prénom, ou raison sociale), identité de l'acheteur, et **prix total TTC écrit en chiffres et en lettres**.
- Le **décret 16-66** prévoit un « bon de transaction commerciale » qui tient lieu de facture dans certains cas (désignation, prix unitaire, quantité).
- **À vérifier** sur le texte officiel : la liste complète des mentions, les règles de la facture d'avoir, le cachet et la signature.

**Ce que cela change par rapport au cahier des charges (à valider par vous) :**

| Point | Constat | Proposition |
|---|---|---|
| Total en lettres | Exigé sur la facture, absent du cahier des charges | L'ajouter aux PDF, en français et en arabe |
| Facture récapitulative | Prévue par le décret, absente de la liste | « Plus tard » : regrouper plusieurs bons de livraison d'un même client sur une facture |
| Bon de transfert | Prévu par le décret (déplacement de marchandise entre ses propres locaux) | « Plus tard » : inutile pour un commerçant à un seul magasin |
| Ticket de caisse | La caisse sort « ticket ou facture » | Le ticket porte ses propres mentions réglables ; la facture reste disponible sur demande du client |

Sources : [Ministère du Commerce – recueil facture](https://www.commerce.gov.dz/fr/reglementation/recueil/conditions-et-modalites-d-etablissement-de-la-facture), [Ministère du Commerce – questions fréquentes](https://commerce.gov.dz/fr/questions-frequentes/themes/facture), [Legal Doctrine – facture en Algérie](https://legal-doctrine.com/edition/quelles-sont-les-conditions-et-modalites-detablissement-dune-facture-en-algerie)

## 3. Droit de timbre — contredit le cahier des charges

- Le cahier des charges demande un « droit de timbre réglable », ce qui laisse penser à un seul taux.
- Depuis la **loi de finances 2025**, le timbre de quittance serait calculé **par tranches, sans plafond** : exonéré jusqu'à 300 DA, puis 1 DA, 1,5 DA ou 2 DA par tranche de 100 DA selon le montant, minimum 5 DA. L'ancienne règle (1 %, plafond 10 000 DA) circule encore sur certains sites.
- Il ne s'appliquerait qu'aux **paiements en espèces**.
- **À vérifier** auprès de votre comptable : ces chiffres viennent de blogs et d'outils en ligne, pas du Code du timbre.
- Proposition : le réglage est un **tableau de tranches** (seuil, montant par 100 DA, minimum, plafond facultatif, modes de paiement concernés), modifiable par l'administrateur, avec la possibilité pour chaque commerçant de le désactiver.

Sources : [L'entrepreneur algérien – timbre de quittance](https://lentrepreneuralgerien.com/impots/item/128-le-droit-de-timbre-timbre-de-quittances-en-algerie), [Amina Hadji – LF 2025](https://www.aminahadji.com/droit-de-timbre-lf-2025/), [Legal Doctrine – réaménagement du timbre](https://legal-doctrine.com/en/edition/reamenagement-du-mode-de-calcul-du-droit-de-timbre-de-quittance-une-reforme-fiscale-importante-b8cda97cd9e7d45028f7b4fa96c01bc6), [Lamacta – facturation 2026](https://lamacta.com/en/blog/guide-facturation-legale-algerie-2026/)

## 4. TVA

- La recherche n'a pas ramené de source fiable sur les taux en vigueur. Les taux seront une liste réglable par l'administrateur, choisie par produit ; un commerçant non assujetti peut désactiver la TVA. Aucun taux par défaut ne sera écrit dans le code : vous les saisirez à l'installation.

## 5. Durée de conservation

- **10 ans, confirmé** : l'article 12 du Code de commerce impose de conserver les livres et documents pendant dix ans. Le texte comptable (SCF) précise dix ans à compter de la clôture de l'exercice.
- Le réglage par défaut de 10 ans du cahier des charges est donc correct. Le compte partira de la fin de l'exercice.

Sources : [Code de commerce – dz-code](https://dz-code.blogspot.com/2011/09/code-de-commerce.html), [Ministère des Finances – JO n° 74](https://www.mf.gov.dz/pdf/texte/autre_textes/upl-e3c3c2013fefd5dab13560df1b8b5bbe.pdf), [L'entrepreneur algérien – livres légaux](https://lentrepreneuralgerien.com/juridique/item/125-les-livres-registres-legaux-en-algerie)

## 6. Boutique en ligne : loi 18-05 sur le commerce électronique — point d'attention

- La loi impose au vendeur en ligne d'être **inscrit au registre du commerce** et d'avoir un **site hébergé en Algérie** (plusieurs sources ajoutent un nom de domaine en `.dz`).
- L'offre doit être visible, lisible et compréhensible, avec : identité, adresse, téléphone, numéro de registre du commerce, NIF, caractéristiques du produit, prix TTC, frais de livraison.
- Retours : les sources ne sont pas d'accord (7 jours après livraison selon l'une, 4 jours ouvrables dans un cas précis selon l'autre). **À vérifier**.

**Conséquences à valider :**

1. Le cahier des charges ouvre l'outil aux vendeurs Instagram « sans magasin ». Un vendeur sans registre du commerce ne respecte pas la loi 18-05 s'il ouvre une boutique en ligne. Proposition : la gestion (stock, caisse, commandes) reste ouverte à tous, mais la mise en ligne de la boutique affiche un avertissement tant que le registre du commerce et le NIF ne sont pas remplis. Vous décidez si c'est un simple avertissement ou un blocage.
2. L'hébergement en Algérie et un domaine `.dz` deviennent une vraie exigence, pas seulement une possibilité. Le guide de l'étape 8 en tiendra compte.
3. Les conditions de retour sont un texte libre du commerçant, sans durée imposée par le code.

Sources : [Loi 18-05 – texte au JO](https://www.mpt.gov.dz/wp-content/uploads/2023/11/Loi-n%C2%B0-18-05-du-10-mai-2018.-fr_0_0.pdf), [Deloitte – brèves juridiques Algérie](https://blog.avocats.deloitte.fr/algerie-breves-fiscales-juridiques/), [Reda Dev – obligations du vendeur](https://redadev.com/en/blog/loi-e-commerce-algerie-obligations), [Neurone – vendre en ligne légalement](https://neuronecoworking.dz/en/guides/commerce-en-ligne)

## 7. Données personnelles : loi 18-07, modifiée par la loi 25-11

- Tout traitement de données personnelles doit être **déclaré à l'ANPDP** avant de commencer. Le transfert de données hors d'Algérie demande une autorisation.
- La loi 25-11 (juillet 2025) ajoute un registre des traitements, la journalisation et, dans certains cas, un délégué à la protection des données. Les contrôles ont commencé en 2026.
- Conséquences : vous, comme éditeur de la plateforme, aurez une déclaration à faire (démarche à votre charge, hors application). L'application fournira : un registre des traitements, l'export et la suppression sur demande, et un modèle de contrat de sous-traitance entre vous et chaque commerçant. L'hébergement en Algérie évite la question du transfert à l'étranger.

Sources : [CMS – guide Algérie](https://cms.law/en/int/expert-guides/cms-expert-guide-to-data-protection-and-cyber-security-laws/algeria2), [Gide – réglementation algérienne](https://www.gide.com/en/news-insights/protection-of-personal-data-focus-on-algerian-regulations/), [Zoom Algérie – loi 18-07](https://zoomalgerie.com/loi-18-07-protection-donnees-algerie/), [Algeria Tech – contrôles 2026](https://algeriatech.news/algeria-anpdp-field-inspections-private-sector-audits-2026/)

## 8. Sécurité : recommandations actuelles

- **Argon2id reste le premier choix d'OWASP.** Réglage minimum le plus cité : 19 Mio de mémoire, 2 itérations, 1 fil (ou 46 Mio, 1 itération). **À vérifier** sur la page OWASP, non joignable d'ici. Les réglages seront dans la configuration et le hachage sera refait à la connexion quand ils changent.
- Le chiffrement des téléphones pose un problème que le cahier des charges ne traite pas : on ne peut pas chercher dans un champ chiffré, alors qu'il faut retrouver un client par son téléphone et alerter sur ses retours. Solution classique : stocker à côté une **empreinte HMAC** du téléphone (clé séparée), qui sert uniquement à la recherche exacte.
- Les autres choix du cahier des charges (RLS forcée, cookies HttpOnly/Secure/SameSite, CSRF, CSP, AES-256-GCM, clés hors de la base, TLS 1.3) restent conformes aux pratiques actuelles. La liste de contrôle ASVS détaillée sera faite à l'étape 8.

Sources : [OWASP – Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Ory – paramètres Argon2](https://www.ory.com/choose-recommended-argon2-parameters-password-hashing)

## 9. Outils existants

- En Algérie, l'offre est coupée en deux : des logiciels de caisse et de stock installés sur PC (type EasyStock), et des outils de boutique en ligne centrés sur le paiement à la livraison et les transporteurs (Colisify, module Odoo « DZ Ecommerce », Yalidine avec son API). Les comparatifs notent que le stock est souvent secondaire dans les outils de vente en ligne.
- Peu d'outils relient vraiment le magasin physique et la boutique en ligne sur un même stock, sur téléphone, en arabe : c'est la place de ce produit.
- La recherche n'a rien donné de fiable sur EcoTrack, Foorweb et YouCan. Chaque module aura sa propre recherche plus poussée avant d'être codé.

Sources : [Zoom Algérie – comparatif gestion de stock](https://zoomalgerie.com/?p=17160), [Odoo – DZ Ecommerce](https://apps.odoo.com/apps/modules/18.0/dz_ecommerce), [We Are Tech – Yalidine](https://www.wearetech.africa/fr/fils/solutions/logistique-et-e-commerce-yalidine-express-accelere-la-livraison-en-algerie), [Ouedkniss – EasyStock](https://www.ouedkniss.com/applications-software-logiciel-de-gestion-stock-easystock-batna-algeria-d28377713)

## 10. Versions des outils (registre npm, 15/11/2026)

| Outil | Version | Outil | Version |
|---|---|---|---|
| Next.js | 16.4.6 | Vitest | 5.1.0 |
| React | 19.3.1 | Playwright | 1.65.1 |
| TypeScript | 7.0.2 | Zod | 4.6.7 |
| Tailwind CSS | 4.3.5 | next-intl | 4.15.1 |
| Kysely | 0.29.9 | zxing-wasm | 3.1.6 |
| pg | 8.23.1 | sharp | 0.35.5 |
| @node-rs/argon2 | 2.2.2 | bwip-js | 4.11.4 |

Node.js 22 et PostgreSQL 16 sont installés dans l'environnement de travail. La dernière version stable de PostgreSQL et la compatibilité de TypeScript 7 avec Next.js 16 seront vérifiées au début de l'étape 1, dans leur documentation.
