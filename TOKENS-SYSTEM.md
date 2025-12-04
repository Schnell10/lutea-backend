# Système de Tokens JWT - Documentation

## Vue d'ensemble

L'application utilise un système de **double tokens JWT** pour l'authentification :
- **Access Token** : Token d'accès de courte durée (15 minutes)
- **Refresh Token** : Token de renouvellement de longue durée (4h pour admins, 7j pour clients)

---

## Architecture des Tokens

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTÈME DE TOKENS                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐       │
│  │  Access Token    │         │  Refresh Token    │       │
│  ├──────────────────┤         ├──────────────────┤       │
│  │ Durée : 15 min   │         │ Admins : 4h      │       │
│  │ Contenu :        │         │ Clients : 7j      │       │
│  │ - email          │         │ Contenu :         │       │
│  │ - userId         │         │ - userId         │       │
│  │ - role           │         │ - type: refresh  │       │
│  │                  │         │                  │       │
│  │ Stockage :       │         │ Stockage :       │       │
│  │ Cookie httpOnly  │         │ Cookie httpOnly  │       │
│  └──────────────────┘         └──────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Flux de Connexion

```
┌─────────────┐
│ CONNEXION   │
│ (Login)     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Backend vérifie email/password      │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Génération des tokens :              │
│ • Access Token (15 min)              │
│ • Refresh Token (4h ou 7j selon rôle)│
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Stockage dans cookies httpOnly      │
│ • access_token                      │
│ • refresh_token                      │
└─────────────────────────────────────┘
```

---

## Utilisation Normale (Access Token Valide)

```
┌─────────────────────────────────────────────────────────────┐
│              REQUÊTE API PENDANT UTILISATION                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Client fait une requête API                             │
│     fetchWithRefresh('/api/bookings')                       │
│                                                             │
│  2. Navigateur envoie automatiquement les cookies           │
│     • access_token (valide)                                 │
│     • refresh_token                                         │
│                                                             │
│  3. Backend vérifie l'access token                          │
│     ✅ Token valide → Requête acceptée                      │
│                                                             │
│  4. Réponse retournée au client                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Refresh Périodique (GlobalAuthRefresh)

```
┌─────────────────────────────────────────────────────────────┐
│           REFRESH PÉRIODIQUE (Toutes les 10 min)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │ setInterval (10 minutes)            │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                           │
│                 ▼                                           │
│  ┌──────────────────────────────────────┐                  │
│  │ Vérifie si utilisateur connecté      │                  │
│  │ (via store Zustand)                 │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                           │
│                 ▼                                           │
│  ┌──────────────────────────────────────┐                  │
│  │ Appelle /auth/refresh                │                  │
│  │ avec refresh_token                   │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                           │
│                 ▼                                           │
│  ┌──────────────────────────────────────┐                  │
│  │ Backend génère nouveau access_token  │                  │
│  │ (refresh_token reste inchangé)       │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  ✅ Access token renouvelé avant expiration                │
│  ✅ Utilisateur reste connecté sans interruption           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Gestion de l'Expiration (fetchWithRefresh)

```
┌─────────────────────────────────────────────────────────────┐
│        QUAND L'ACCESS TOKEN EXPIRE (Après 15 min)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Client fait une requête API                            │
│     fetchWithRefresh('/api/bookings')                       │
│                                                             │
│  2. Backend répond : 401 Unauthorized                      │
│     (Access token expiré)                                   │
│                                                             │
│  3. fetchWithRefresh détecte le 401                         │
│     ┌────────────────────────────────────┐               │
│     │ Appelle automatiquement refreshToken()│              │
│     └──────────────┬───────────────────────┘              │
│                    │                                        │
│                    ▼                                        │
│  4. POST /auth/refresh                                      │
│     avec refresh_token (cookie)                             │
│                                                             │
│  5. Backend génère nouveau access_token                     │
│     (refresh_token reste inchangé)                         │
│                                                             │
│  6. fetchWithRefresh réessaie la requête                    │
│     avec le nouveau access_token                             │
│                                                             │
│  7. ✅ Requête réussit                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Retour sur le Site (Reconnexion Automatique)

### Pour les Clients (Refresh Token : 7 jours)

```
┌─────────────────────────────────────────────────────────────┐
│              CLIENT REVIENT SUR LE SITE                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Page se charge                                          │
│     (_app.jsx s'exécute)                                    │
│                                                             │
│  2. Vérification automatique au chargement                  │
│     fetchWithRefresh('/auth/profile')                       │
│                                                             │
│  3. Access token expiré → 401                               │
│                                                             │
│  4. fetchWithRefresh fait le refresh automatique             │
│     avec refresh_token (encore valide 7 jours)             │
│                                                             │
│  5. Nouveau access_token généré                             │
│                                                             │
│  6. Store rempli avec données utilisateur                   │
│                                                             │
│  ✅ Client reconnecté automatiquement                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Pour les Admins (Refresh Token : 4 heures)

```
┌─────────────────────────────────────────────────────────────┐
│              ADMIN REVIENT SUR LE SITE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SCÉNARIO A : Retour < 4 heures                             │
│  ────────────────────────────────────────                   │
│  1. Page se charge                                          │
│  2. Vérification automatique                                │
│  3. Access token expiré → 401                               │
│  4. Refresh automatique avec refresh_token (valide)         │
│  5. ✅ Admin reconnecté automatiquement                      │
│                                                             │
│  SCÉNARIO B : Retour > 4 heures                             │
│  ────────────────────────────────────────                   │
│  1. Page se charge                                          │
│  2. Vérification automatique                                │
│  3. Access token expiré → 401                               │
│  4. Tentative de refresh                                    │
│  5. ❌ Refresh token aussi expiré                           │
│  6. Store vide                                              │
│  7. 🔒 Admin doit se reconnecter manuellement               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparaison des Durées

| Type Utilisateur | Access Token | Refresh Token | Comportement |
|------------------|--------------|---------------|--------------|
| **Client** | 15 minutes | 7 jours | Reconnexion automatique pendant 7 jours |
| **Admin** | 15 minutes | 4 heures | Reconnexion automatique seulement si retour < 4h |

---

## Sécurité

### Pourquoi deux tokens ?

1. **Access Token court (15 min)** :
   - Limite les risques en cas de vol
   - Même si volé, expire rapidement

2. **Refresh Token long (4h/7j)** :
   - Permet de rester connecté sans se reconnecter souvent
   - Stocké dans cookie httpOnly (non accessible en JavaScript)

### Protection contre les attaques

- **XSS** : Cookies httpOnly → non accessibles en JavaScript
- **CSRF** : SameSite cookie → protection contre les requêtes cross-site
- **Vol de token** : Access token expire rapidement
- **Session hijacking** : Refresh token dans cookie sécurisé

---

## Composants Frontend

### `useAuthRefresh` Hook
- `refreshToken()` : Rafraîchit manuellement le token
- `fetchWithRefresh()` : Wrapper autour de `fetch` avec refresh automatique

### `GlobalAuthRefresh` Composant
- Refresh périodique toutes les 10 minutes
- Maintient la session active tant que l'utilisateur est sur le site

### `_app.jsx`
- Vérification au chargement de l'app
- Reconnexion automatique si refresh token valide

---

## Endpoints Backend

### `/auth/login` (POST)
- Vérifie email/password
- Génère access_token + refresh_token
- Stocke dans cookies httpOnly

### `/auth/refresh` (POST)
- Prend refresh_token depuis cookie
- Génère nouveau access_token
- Retourne les données utilisateur

### `/auth/logout` (POST)
- Supprime les cookies (access_token + refresh_token)

---

## Exemple de Cycle de Vie

```
Jour 1, 10h00 - Connexion
├─ Access Token : valide jusqu'à 10h15
└─ Refresh Token : valide jusqu'au Jour 8, 10h00 (client)
                   valide jusqu'au Jour 1, 14h00 (admin)

Jour 1, 10h10 - Requête API
├─ Access Token encore valide
└─ ✅ Requête acceptée

Jour 1, 10h16 - Requête API
├─ Access Token expiré → 401
├─ fetchWithRefresh détecte le 401
├─ Refresh automatique avec refresh_token
├─ Nouveau Access Token : valide jusqu'à 10h31
└─ ✅ Requête réussit

Jour 1, 10h20 - Refresh périodique
├─ GlobalAuthRefresh appelle /auth/refresh
├─ Nouveau Access Token : valide jusqu'à 10h35
└─ ✅ Session maintenue

Jour 2, 14h00 - Client revient
├─ Refresh Token encore valide (7 jours)
├─ Vérification au chargement
├─ Refresh automatique
└─ ✅ Client reconnecté

Jour 2, 15h00 - Admin revient (> 4h)
├─ Refresh Token expiré (4h)
├─ Vérification au chargement
├─ Refresh échoue
└─ 🔒 Admin doit se reconnecter manuellement
```

---

## Points Clés

1. **Access Token** = Carte d'accès (15 min) → utilisé pour chaque requête
2. **Refresh Token** = Carte de renouvellement (4h/7j) → utilisé uniquement pour obtenir un nouveau access token
3. **Refresh Périodique** = Maintient la session active tant que l'utilisateur est sur le site
4. **fetchWithRefresh** = Gère automatiquement les tokens expirés lors des requêtes
5. **Durées différentes** = Sécurité renforcée pour les admins (4h vs 7j)

