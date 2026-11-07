# Épreuves — Lycées Scientifiques du Togo

## Fonctionnement
- Vercel héberge le site.
- Supabase stocke les fiches et les PDF.
- Lecture publique sans compte.
- Les dépôts passent par une fonction sécurisée avec Cloudflare Turnstile.

## Configuration Supabase
1. Créer un projet sur https://supabase.com/.
2. Dans **SQL Editor**, exécuter entièrement `supabase/schema.sql`.
3. Dans **Project Settings → API**, copier l'URL et la clé publique anon/publishable.
4. Dans `app.js`, remplacer les constantes `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `TURNSTILE_SITE_KEY`.
5. Créer un widget Cloudflare Turnstile en mode Managed pour le domaine du site. Mettre la clé site dans `app.js`.

## Déployer la fonction sécurisée
Installer Supabase CLI, puis à la racine du dépôt :
```bash
supabase login
supabase link --project-ref TON_PROJECT_REF
supabase secrets set TURNSTILE_SECRET_KEY=TA_CLE_SECRETE_CLOUDFLARE
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=TA_CLE_SERVICE_ROLE
supabase functions deploy submit-exam --no-verify-jwt
```
La clé service_role doit rester dans les secrets Supabase, jamais dans le code ou GitHub. La fonction vérifie Turnstile, valide les données, limite chaque IP à 4 dépôts par tranche de 10 minutes et publie le PDF.

## Sécurité
- Les visiteurs peuvent lire les épreuves et PDF sans compte.
- Aucun dépôt direct public dans la base ou le stockage.
- Dépôt contrôlé par captcha côté serveur, champ piège, délai minimal, validation du PDF et limite par IP.
- Taille maximale : 15 Mo.
