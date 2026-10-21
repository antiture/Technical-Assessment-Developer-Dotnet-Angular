
# Technical-Assessment-Developer-Dotnet-Angular


## Général

Ce TP technique vise à tester vos compétences en Angular et ASP.NET Core. Ne perdez pas de temps sur le design, il ne sera pas évalué.

### Prérequis techniques

Le TP utilise .NET Aspire pour configurer une bdd PostgreSQL, une webapi ASP.NET Core, et un front Angular.

Il vous faudra donc :
- Docker Desktop (ou similaire)
- .NET 9 SDK avec ASP.NET
- nodeJS >= 22.12

### Lancement

Il suffit de lancer le projet Aspire disponible dans `backend\src\AppHost`.

Aspire lance la bdd, le backend et le frontend. 

La console dotnet affiche le lien vers le dashboard Aspire pour consulter les services applicatifs.

### Critères d'évaluation

Nous fournissons ci-dessous les besoins fonctionnels à développer, ainsi que leurs critères d'acceptation.

Pour faciliter notre évaluation, merci de :

- faire des commits réguliers ;
- compléter la section "Mes Notes" à la fin de ce readme.md pour lister les tâches réalisées et éventuelles pistes d'amélioration.

### Rendu du travail

Créer un repo privé sur GitHub et inviter l'utilisateur suivant : n2jsoft-hr-cr

Ce repo doit inclure l'ensemble des fichiers (backend et frontend).


## Besoins fonctionnels

On souhaite mettre en place une solution de gestion des dépenses utilisable par un administrateur (typiquement secrétaire ou comptable) pour des utilisateurs de la société.

Les utilisateurs ne saisissent donc pas directement leurs dépenses ; c'est l'administrateur qui s'en charge.

### Gestion des Users

Un utilisateur doit être affectable à une note de frais ; on dit de cet utilisateur qu'il est l'"utilisateur affecté" à la note de frais.

Il ne peut y avoir qu'un seul utilisateur affecté à une note de frais, mais un utilisateur peut etre affecté à plusieurs notes de frais.

Chaque utilisateur a droit à un nombre maximum de dépenses par mois calendaire.

Un utilisateur peut être actif ou inactif. Seuls les utilisateurs actifs peuvent être affectés à une note de frais.

Un utilisateur a un nom, prénom et une adresse postale.

Un utilisateur peut etre supprimé (suppression logique).

### Gestion des Expenses

Une dépense est définie par les attributs suivants :
- une date au format exemple suivant : "mercredi 15 octobre 2025" ;
- une description : maximum 50 caractères ;
- un montant en euros ;
- une adresse de facturation (enseigne / rue + code postal + ville).

Ces attributs peuvent être éditables en tout temps.

Dans le cas où l'utilisateur a atteint son quota de dépenses au mois, un message d'erreur doit l'en informer et il ne peut pas créer sa nouvelle dépense.

Une dépense peut etre supprimée (suppression logique).

### Gestion des Expense Reports

Une note de frais contient les dépenses d'un utilisateur au mois.

Le format de l'intitulé d'une note de frais doit respecter le format "Utilisateur - Mois Année", par ex : "Juste Leblanc - Octobre 2025".

L'intitulé n'est pas éditable.

Une note de frais peut être supprimable (suppression physique).

La page de visualisation des notes de frais permet d'ajouter une note de frais en sélectionnant le mois et l'utilisateur.

La page de visualisation d'une note de frais permet : 
- d'y ajouter des dépenses ;
- d'afficher les dépenses existantes par lot de 5.


## Mes Notes

### Choix de conception — suppression des notes de frais

Une note de frais (`ExpenseReport`) peut être supprimée **physiquement**, conformément au besoin fonctionnel. Sa suppression entraîne celle de toutes les dépenses (`Expense`) qui lui sont rattachées grâce à la relation PostgreSQL / EF Core configurée avec `ON DELETE CASCADE`. Cela garantit qu'aucune dépense orpheline ne subsiste.

La suppression d'une **dépense individuelle** reste **logique** (`soft delete`), comme le demande également l'énoncé. Ces deux actions ont donc volontairement des sémantiques distinctes : suppression logique d'une dépense isolée, suppression physique d'une note de frais et de ses dépenses.

**Limite / évolution possible :** si le système devait répondre à des exigences d'audit, de conservation comptable ou de traçabilité réglementaire, une stratégie d'archivage et de rétention des données serait préférable à une suppression définitive.

### Choix de conception — intitulé et nom de l'utilisateur

Lors de sa création, une note de frais conserve une **copie du nom affiché de l'utilisateur** (`UserDisplayName`). Son intitulé est construit au format requis `Utilisateur - Mois Année` et n'est pas éditable.

Une modification ultérieure du nom ou du prénom de l'utilisateur **ne modifie pas rétroactivement** l'intitulé des notes de frais existantes. Ce choix assure la stabilité de l'intitulé historique et évite une dépendance de lecture en temps réel au module Users pour sa construction.

**Compromis assumé :** l'intitulé historique peut différer du nom actuel de l'utilisateur. L'identifiant `UserId` reste la référence technique de l'utilisateur affecté.

### Architecture — monolithe modulaire

L’application est déployée en un seul processus ASP.NET Core et structurée en deux modules fonctionnels, **Users** et **Expenses**, avec des dossiers API, Domain et Infrastructure. Nous avons choisi un **monolithe modulaire**, sans microservices ni communication réseau entre modules, afin de limiter le coût opérationnel et la complexité de ce TP.

Le module **Expenses** accède aux informations nécessaires du module **Users** uniquement via le contrat `IUserPolicyReader` (`Users.Contracts`) ; il n’accède pas directement aux entités `Users.Domain` ou à leur infrastructure. La dépendance métier est donc orientée **Expenses → Users.Contracts**. Les enregistrements de dépenses conservent l’identifiant de l’utilisateur au travers de leur note de frais, sans imposer une dépendance de domaine directe vers l’entité User.

Les modules utilisent volontairement un **`AppDbContext` partagé** et une même base PostgreSQL. Ce compromis simplifie la configuration Aspire, les migrations EF Core et les opérations transactionnelles dans le périmètre du test. Il ne garantit toutefois **pas une isolation stricte** : un développeur pourrait accéder aux entités d’un autre module via le contexte partagé.

Trois tests `ArchitectureBoundaryTests` contrôlent les **références explicites de namespaces dans les fichiers C#** : absence de dépendance d’`Expenses.Domain` vers Users, accès d’Expenses à `Users.Contracts` uniquement, et absence de dépendance de Users vers Expenses. Comme les modules résident dans un **même assembly**, ces tests sont des garde-fous de source, **pas une preuve d’isolation complète** (ils ne détectent pas toutes les dépendances sémantiques, ni les références par réflexion). Une évolution du projet pourrait utiliser des assemblies distincts et des tests d’architecture basés sur Roslyn.

L’enregistrement des services intermodules est centralisé dans `AddModuleServices()`. Les endpoints Minimal API gardent ici la logique d’orchestration applicative : une couche Application dédiée ne serait envisagée que si la complexité fonctionnelle justifiait cette abstraction supplémentaire.


### Frontend — interface d'administration

- Application **Angular 20 / Nx** avec composants standalone, Reactive Forms, Signals et services HTTP typés.
- Page **Utilisateurs** : liste, création, modification du profil et du plafond mensuel, activation/désactivation et suppression logique via les API existantes. Les formulaires sont présentés en boîtes de dialogue modales.
- Page **Notes de frais** : consultation de la liste, création pour un utilisateur actif et un mois, suppression physique avec confirmation ; l'intitulé est construit par le backend et n'est pas modifiable.
- La création d'une note peut inclure une **première dépense facultative**. Il s'agit de deux requêtes HTTP successives ; si la seconde échoue, la note créée est conservée et l'interface signale cette réussite partielle.
- **Consulter** ouvre une boîte de dialogue montrant les dépenses (libellé, date, montant en EUR, adresse de facturation) par pages de cinq ; les dépenses peuvent être ajoutées, modifiées et supprimées depuis cette interface.
- Les règles métier (date, limites, utilisateur actif, doublons) sont contrôlées côté serveur ; le frontend offre les validations de saisie et affiche les réponses d'erreur.
- Le frontend utilise le proxy local `/api` ; l'API ASP.NET Core et PostgreSQL sont démarrés par Aspire.

### Vérification

À partir de `frontend/` :

```cmd
npm test -- --run
npm run build
npx nx lint n2f
```

La dernière exécution communiquée (20/10/2026) donne **75/75 tests Vitest réussis** sur **13 fichiers**, compilation Angular réussie (résultat fourni via cache Nx), et ESLint avec 0 erreur et 2 avertissements `no-non-null-assertion` dans l'ancien test de routage. Les avertissements de test sont corrigés dans le nettoyage final ; **la nouvelle version doit être revérifiée localement**. Le backend avait également passé 46/46 tests lors de l'exécution précédemment communiquée.

Pour éviter de prendre un résultat de cache pour une recompilation fraîche :

```cmd
npx nx reset
npm test -- --run
npx nx build n2f --skip-nx-cache
npx nx lint n2f
```

### Limites et évolutions possibles

- Le filtre des utilisateurs actifs interroge les détails de chaque utilisateur lorsque la liste ne fournit que l'identifiant et le nom : coût **N+1** acceptable pour ce TP, à optimiser via un DTO de liste adapté à plus grande échelle.
- La création d'une note et de sa première dépense **n'est pas atomique** entre les deux requêtes ; une transaction applicative côté serveur ou un endpoint dédié serait nécessaire si l'atomicité était exigée.
- Les tests Vitest et la compilation ne remplacent pas le **parcours manuel de bout en bout** (Aspire + PostgreSQL + Angular), à vérifier avant livraison.
- Nx Cloud peut afficher un avertissement de credentials 401 ; cela ne remet pas en cause les tests exécutés localement. Une configuration/connexion valide est nécessaire pour bénéficier du cache distant.
