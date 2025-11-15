import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';

/**
 * Helper pour créer un utilisateur de test VÉRIFIÉ
 */
export async function createTestUser(app: INestApplication, userData?: Partial<any>) {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '0612345678',
    address: '123 rue Test',
    city: 'Paris',
    postalCode: '75001',
    country: 'France',
    ...userData,
  };

  // Si c'est un admin, on doit le créer directement dans la DB
  // (car /auth/register n'accepte pas le champ 'role')
  if (userData?.role === 'admin') {
    const UserModel = app.get(getModelToken('User'));

    const hashedPassword = await bcrypt.hash(defaultUser.password, 10);
    const adminUser = new UserModel({
      email: defaultUser.email,
      password: hashedPassword,
      firstName: defaultUser.firstName,
      lastName: defaultUser.lastName,
      phone: defaultUser.phone,
      address: defaultUser.address,
      city: defaultUser.city,
      postalCode: defaultUser.postalCode,
      country: defaultUser.country,
      role: 'admin',
      isEmailVerified: true, 
    });

    await adminUser.save();

    return {
      user: {
        ...defaultUser,
        _id: adminUser._id.toString(),
        role: 'admin',
      },
      response: { body: { user: adminUser } },
    };
  }

  // Pour les utilisateurs normaux : utiliser le flow register + validation

  // Étape 1 : Créer le compte temporaire (sans le champ 'role' s'il existe)
  const { role: _role, ...registerData } = defaultUser as any;
  await request(app.getHttpServer())
    .post('/auth/register')
    .send(registerData);

  // Étape 2 : Récupérer le token de validation depuis la DB
  const TemporaryUserModel = app.get(getModelToken('TemporaryUser'));
  const tempUser = await TemporaryUserModel.findOne({ email: defaultUser.email });

  if (!tempUser) {
    throw new Error(`Utilisateur temporaire non trouvé pour ${defaultUser.email}`);
  }

  // Étape 3 : Valider l'email avec le token
  const validateResponse = await request(app.getHttpServer())
    .post('/auth/validate-email')
    .send({ token: tempUser.verificationToken });

  return {
    user: {
      ...defaultUser,
      _id: validateResponse.body.user._id,
    },
    response: validateResponse,
  };
}

/**
 * Helper pour extraire les cookies depuis les headers
 */
function extractCookiesFromHeaders(headers: any): string {
  const setCookies = headers['set-cookie'] || [];
  const cookiesArray = Array.isArray(setCookies) ? setCookies : [setCookies];
  
  // Extraire uniquement la partie "name=value" de chaque cookie
  const cookieParts = cookiesArray.map((cookie: string) => {
    const match = cookie.match(/^([^=]+=[^;]+)/);
    return match ? match[1] : cookie;
  });
  
  // Joindre les cookies avec "; " pour le format Cookie header
  return cookieParts.join('; ');
}

/**
 * Helper pour se connecter et récupérer les tokens
 * Gère automatiquement la 2FA pour les admins
 */
export async function loginTestUser(app: INestApplication, email: string, password: string) {
  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  // Si c'est un admin avec 2FA requise
  if (loginResponse.body.requires2FA) {
    // Récupérer le code 2FA depuis la DB
    const UserModel = app.get(getModelToken('User'));
    const user = await UserModel.findOne({ email }).exec();
    
    if (!user || !user.verificationCode) {
      throw new Error(`Code 2FA non trouvé pour l'admin ${email}`);
    }

    // Soumettre le code 2FA pour finaliser la connexion
    const verifyResponse = await request(app.getHttpServer())
      .post('/auth/2fa/finalize')
      .send({ email, code: user.verificationCode })
      .expect(200);

    // Les cookies sont maintenant dans la réponse de finalize
    return {
      user: verifyResponse.body.user,
      accessToken: verifyResponse.body.access_token,
      refreshToken: verifyResponse.body.refresh_token,
      cookies: extractCookiesFromHeaders(verifyResponse.headers),
      response: verifyResponse,
    };
  }

  // Pour les utilisateurs normaux (pas de 2FA)
  const cookies = extractCookiesFromHeaders(loginResponse.headers);
  
  return {
    user: loginResponse.body.user,
    accessToken: loginResponse.body.access_token,
    refreshToken: loginResponse.body.refresh_token,
    cookies,
    response: loginResponse,
  };
}

/**
 * Helper pour faire une requête authentifiée
 */
export async function authenticatedRequest(
  app: INestApplication,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  cookies: string,
  body?: any
) {
  const req = request(app.getHttpServer())[method](url);
  
  // Ajouter les cookies d'authentification
  if (cookies) {
    req.set('Cookie', cookies);
  }
  
  // Ajouter le body si présent
  if (body) {
    req.send(body);
  }
  
  return req;
}

/**
 * Helper pour créer une retraite de test
 */
export async function createTestRetreat(app: INestApplication, authToken: string, retreatData?: Partial<any>) {
  // Les dates doivent être des strings ISO (pas des Date objects) pour le DTO
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  
  // Extraire prix, places, adresseRdv de retreatData s'ils existent pour les mettre dans dates
  const { prix, places, adresseRdv, dates: customDates, ...otherData } = retreatData || {};
  
  const defaultRetreat = {
    titreCard: 'Retraite Test',
    imageCard: 'https://example.com/image.jpg',
    altImageCard: 'Image test',
    imageModal: ['https://example.com/image1.jpg'],
    altImageModal: ['Image modal test'],
    texteModal: 'Description de la retraite test',
    // prix, places, adresseRdv doivent être DANS dates, pas au niveau racine
    dates: customDates || [
      {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        heureArrivee: '14:00',
        heureDepart: '16:00',
        prix: prix || 500,
        places: places || 10,
        adresseRdv: adresseRdv || '123 rue Test, 75001 Paris',
      },
    ],
    aVenir: false,
    isActive: true,
    ...otherData,
  };

  // Envoyer la requête avec les cookies d'authentification
  const response = await request(app.getHttpServer())
    .post('/retreats/admin')
    .set('Cookie', authToken)
    .send(defaultRetreat);

  return {
    retreat: response.body,
    response,
  };
}

/**
 * Helper pour créer un booking de test
 */
export async function createTestBooking(
  app: INestApplication,
  cookies: string,
  retreatId: string,
  bookingData?: Partial<any>
) {
  // Récupérer la retraite pour utiliser ses dates exactes
  const RetreatModel = app.get(getModelToken('Retreat'));
  const retreat = await RetreatModel.findById(retreatId).exec();
  
  if (!retreat || !retreat.dates || retreat.dates.length === 0) {
    throw new Error(`Retraite ${retreatId} non trouvée ou sans dates`);
  }
  
  // Utiliser la première date de la retraite (les dates doivent correspondre exactement)
  const retreatDate = retreat.dates[0];
  
  // Utiliser exactement comme dans le frontend : selectedBlock?.start et selectedBlock?.end
  // Mongoose peut retourner les dates comme Date objects ou strings selon la config
  // Quand sérialisé en JSON, les Date objects deviennent automatiquement des ISO strings
  // On utilise directement les valeurs sans conversion pour correspondre exactement
  const dateStart = retreatDate.start;
  const dateEnd = retreatDate.end;
  
  const defaultBooking = {
    retreatId: retreatId, // S'assurer que retreatId est bien présent
    retreatName: retreat.titreCard || 'Retraite Test',
    retreatAddress: retreatDate.adresseRdv || '123 rue Test, 75001 Paris',
    retreatHeureArrivee: retreatDate.heureArrivee || '14:00',
    retreatHeureDepart: retreatDate.heureDepart || '16:00',
    dateStart: dateStart, // Utiliser directement comme dans le frontend (ligne 359 de booking.jsx)
    dateEnd: dateEnd, // Utiliser directement comme dans le frontend (ligne 360 de booking.jsx)
    nbPlaces: 1,
    participants: [
      {
        prenom: 'Test',
        nom: 'Participant',
        email: 'participant@example.com',
      },
    ],
    billingAddress: {
      address: '123 rue Test',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
      phone: '0612345678',
    },
    statut: 'PENDING',
    ...bookingData,
  };

  const response = await authenticatedRequest(
    app,
    'post',
    '/bookings',
    cookies,
    defaultBooking
  );

  return {
    booking: response.body,
    response,
  };
}

/**
 * Helper pour nettoyer la base de données de test
 * Supprime toutes les collections créées pendant les tests
 */
export async function cleanupTestDatabase(app: INestApplication): Promise<void> {
  try {
    // Récupérer la connexion MongoDB depuis l'application
    const { getConnectionToken } = await import('@nestjs/mongoose');
    const connection = app.get(getConnectionToken());
    
    // Liste des collections à nettoyer
    const collections = ['users', 'temporaryusers', 'retreats', 'bookings'];
    
    for (const collectionName of collections) {
      try {
        const collection = connection.collection(collectionName);
        await collection.deleteMany({});
        console.log(`OK: Collection "${collectionName}" nettoyee`);
      } catch {
        // Si la collection n'existe pas, continuer
        console.log(`INFO: Collection "${collectionName}" non trouvee (probablement pas creee)`);
      }
    }
    
    console.log('OK: Base de donnees de test nettoyee avec succes');
  } catch (error) {
    console.error('ERREUR: Erreur lors du nettoyage de la base de donnees:', error);
    // Ne pas faire échouer les tests si le nettoyage échoue
  }
}

/**
 * Helper pour attendre un certain temps (pour les tests de timeout)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

