# Épreuves — Lycées Scientifiques du Togo

Site responsive de consultation et de partage des anciennes épreuves des Lycées Scientifiques du Togo.

## Fonctionnalités

- Accueil avec les 7 établissements : Lomé, Atakpamé, Kara, Sokodé, Dapaong, Tsévié et Kpalimé.
- Recherche et filtres par établissement, classe, trimestre et année scolaire.
- Dépôt de PDF (15 Mo maximum) depuis le formulaire.
- Les PDF et leurs informations sont enregistrés dans Supabase.
- Les épreuves publiées sont visibles et consultables par tous, sans compte.
- Interface responsive pour ordinateur, tablette et téléphone.
- Niveau initial : Secondaire.

## Configuration Supabase obligatoire

1. Crée un projet sur [Supabase](https://supabase.com/).
2. Dans **SQL Editor**, exécute tout le fichier `supabase/schema.sql`.
3. Dans **Project Settings → API**, copie l'URL du projet et la clé publique **anon** (ou publishable).
4. Dans `app.js`, remplace les deux valeurs vides au début du fichier :

   ```js
   const SUPABASE_URL = "https://TON-PROJET.supabase.co";
   const SUPABASE_ANON_KEY = "TA_CLE_PUBLIQUE_ANON";
   ```

5. Publie à nouveau le site.

**Important :** utilise uniquement la clé publique anon/publishable. Ne mets jamais la clé `service_role` dans le code du navigateur.

## Accès et sécurité

- La lecture des métadonnées et des PDF publiés est publique.
- Les visiteurs peuvent déposer une épreuve sans compte ; elle est publiée immédiatement.
- Les visiteurs ne peuvent pas modifier ni supprimer les épreuves déjà enregistrées.
- Le bucket limite les fichiers aux PDF de 15 Mo maximum.
- Comme les dépôts sont publics et instantanés, une protection anti-spam / CAPTCHA et un mécanisme de signalement pourront être ajoutés si nécessaire.

## Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── supabase/
    └── schema.sql
```
