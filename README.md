# Épreuves — Lycées Scientifiques du Togo

Site responsive de consultation et de partage des anciennes épreuves des Lycées Scientifiques du Togo.

## Fonctionnalités

- Accueil avec les 7 établissements : Lomé, Atakpamé, Kara, Sokodé, Dapaong, Tsévié et Kpalimé.
- Recherche et filtres par établissement, classe, trimestre et année scolaire.
- Formulaire de contribution : établissement, niveau, classe, série facultative, matière, type d'évaluation, trimestre, numéro du devoir, année scolaire, précision et PDF.
- PDF limité à 15 Mo.
- Modération : les nouvelles épreuves restent en attente jusqu'à validation.
- Interface responsive pour ordinateur, tablette et téléphone.
- Niveau initial : Secondaire. La structure de données permet d'ajouter d'autres niveaux plus tard.

## Lancer le site

Le site est en HTML, CSS et JavaScript natifs. Ouvre `index.html` dans un navigateur ou déploie le dépôt sur Vercel / GitHub Pages.

## Activer les contributions partagées avec Supabase

Sans configuration Supabase, le site fonctionne en mode local de démonstration : les épreuves et PDF sont enregistrés uniquement dans le navigateur et sur l'appareil utilisé. Ils ne sont pas partagés avec les autres visiteurs.

Pour activer le vrai partage :

1. Crée un projet sur [Supabase](https://supabase.com/).
2. Dans le projet, ouvre **SQL Editor** et exécute le contenu de `supabase/schema.sql`.
3. Dans **Project Settings → API**, copie l'URL du projet et la clé publique **anon** (publishable/anon key).
4. Ouvre `app.js` et renseigne les deux constantes au début du fichier :

   ```js
   const SUPABASE_URL = "https://TON-PROJET.supabase.co";
   const SUPABASE_ANON_KEY = "TA_CLE_PUBLIQUE_ANON";
   ```

5. Publie à nouveau le site.

**Sécurité :** ne mets jamais la clé `service_role` dans le code du navigateur. Le schéma SQL utilise un bucket privé, autorise les envois en attente et ne permet la lecture publique que des épreuves approuvées.

## Valider les épreuves

Les propositions sont enregistrées dans Supabase avec `status = pending`.

1. Ouvre **Supabase → Table Editor → exams**.
2. Vérifie les informations et le PDF associé.
3. Passe le champ `status` à `approved` pour publier l'épreuve, ou à `rejected` pour la refuser.

Les fichiers sont stockés dans le bucket privé `exam-pdfs`. Une épreuve validée devient consultable depuis le site.

## Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── supabase/
    └── schema.sql
```

## À prévoir avant une ouverture publique

- Configurer Supabase et tester un dépôt de PDF réel.
- Désigner une ou plusieurs personnes responsables de la validation.
- Ajouter une protection anti-spam / CAPTCHA si les contributions deviennent nombreuses.
- Vérifier les droits de diffusion des documents avant publication.
