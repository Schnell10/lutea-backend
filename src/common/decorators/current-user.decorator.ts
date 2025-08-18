// Import des fonctionnalités NATIVES de NestJS
// createParamDecorator : Fonction qui permet de créer des décorateurs personnalisés pour les paramètres
// ExecutionContext : Interface qui contient le contexte d'exécution de la requête HTTP
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Création d'un décorateur personnalisé appelé "CurrentUser"
// Ce décorateur peut être utilisé dans les paramètres des méthodes de contrôleur
// Exemple d'utilisation : async getProfile(@CurrentUser() user) { ... }
export const CurrentUser = createParamDecorator(
  // Fonction qui sera exécutée automatiquement par NestJS quand le décorateur est utilisé
  // data : Données optionnelles qu'on peut passer au décorateur (non utilisées ici)
  // ctx : Contexte d'exécution fourni par NestJS (contient la requête HTTP)
  (data: unknown, ctx: ExecutionContext) => {
    // ctx.switchToHttp() : Méthode NATIVE de NestJS pour récupérer le contexte HTTP
    // .getRequest() : Récupère l'objet requête HTTP (comme req dans Express.js)
    const request = ctx.switchToHttp().getRequest();
    
    // request.user : Contient les informations de l'utilisateur connecté
    // Ces infos sont mises automatiquement par le JwtAuthGuard après validation du JWT
    // Structure typique : { sub: "userId", email: "user@email.com", role: "client" }
    // Retourne l'utilisateur pour qu'il soit disponible dans le paramètre de la méthode
    return request.user;
  },
);
