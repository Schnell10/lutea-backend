import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { createTestUser, loginTestUser } from './helpers/test-helpers';

describe('Auth Module (e2e)', () => {
  let app: INestApplication;

  // Setup avant tous les tests
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // J'applique les mêmes middlewares que main.ts
    app.use(cookieParser());
    
    // J'applique les mêmes configurations que main.ts
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
  });

  // Teardown après tous les tests
  afterAll(async () => {
    await app.close();
  });

  // Tests d'inscription
  describe('/auth/register (POST)', () => {
    it('devrait créer un utilisateur temporaire avec tous les champs valides', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`, // Email unique pour éviter les conflits
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '0612345678',
          address: '123 rue Test',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
        })
        .expect(201) 
        .expect((res) => {
          expect(res.body).toHaveProperty('requiresEmailValidation', true);
          expect(res.body).toHaveProperty('email');
        });
    });

    it('devrait rejeter une inscription avec un email invalide', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email', // Format invalide
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '0612345678',
          address: '123 rue Test',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
        })
        .expect(400);
    });

    it('devrait rejeter une inscription avec un mot de passe faible', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: '123', // Trop court, pas de majuscule, etc.
          firstName: 'Test',
          lastName: 'User',
          phone: '0612345678',
          address: '123 rue Test',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
        })
        .expect(400);
    });

    it('devrait rejeter une inscription avec des champs manquants', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Password123!',
          // Manque firstName, lastName, etc.
        })
        .expect(400);
    });
  });

  // Tests de connexion
  describe('/auth/login (POST)', () => {
    it('devrait retourner 401 avec des credentials invalides', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistant@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('devrait retourner 401 ou 400 si email ou password manquant', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          // Manque password
        })
        .expect((response) => {
          // Peut retourner 400 (validation) ou 401 (authentification)
          expect([400, 401]).toContain(response.status);
        });
    });
  });

  // Tests de profil utilisateur
  describe('/auth/profile (GET)', () => {
    it('devrait retourner 401 sans token JWT', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('devrait retourner le profil utilisateur avec un token valide', async () => {
      // Je crée un utilisateur de test
      const { user } = await createTestUser(app);
      
      // Je me connecte pour obtenir les tokens
      const { cookies } = await loginTestUser(app, user.email, user.password);
      
      // Je récupère le profil avec le token
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Cookie', cookies)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', user.email);
          expect(res.body).toHaveProperty('firstName');
          expect(res.body).toHaveProperty('lastName');
        });
    });
  });

  // Tests de refresh token
  describe('/auth/refresh (POST)', () => {
    it('devrait retourner 400 sans refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .expect(400);
    });
  });

  // Tests de mot de passe oublié
  describe('/auth/forgot-password (POST)', () => {
    it('devrait retourner 200 même avec un email inexistant (sécurité)', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'nonexistant@example.com',
        })
        .expect(200) // Ne révèle pas si l'email existe (sécurité)
        .expect((res) => {
          expect(res.body.message).toContain('Si cet email existe');
        });
    });

    it('devrait retourner 400 avec un email invalide', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    });
  });
});

