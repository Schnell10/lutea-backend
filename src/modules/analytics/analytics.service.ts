import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { UserEvent } from './entities/user-event.entity';
import { EventType } from './entities/event-type.entity';
import { CreateSessionDto, UpdateSessionDto, CreateUserEventDto } from './dto/analytics.dto';
import { logger } from '../../common/utils/logger';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(UserEvent)
    private userEventRepository: Repository<UserEvent>,
    @InjectRepository(EventType)
    private eventTypeRepository: Repository<EventType>,
  ) {}

  // Créer une nouvelle session
  async createSession(createSessionDto: CreateSessionDto): Promise<Session> {
    try {
      const session = this.sessionRepository.create({
        session_id: createSessionDto.session_id,
        started_at: new Date(createSessionDto.started_at),
        browser: createSessionDto.browser || null,
        device_type: createSessionDto.device_type || null,
        is_login: createSessionDto.is_login || false,
      });

      const savedSession = await this.sessionRepository.save(session);
      logger.log(`✅ [Analytics] Session créée: ${savedSession.session_id}`);
      return savedSession;
    } catch (error) {
      logger.error('❌ [Analytics] Erreur création session:', error);
      throw error;
    }
  }

  // Mettre à jour une session (fin de session)
  async updateSession(sessionId: string, updateSessionDto: UpdateSessionDto): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({ 
        where: { session_id: sessionId } 
      });

      if (!session) {
        throw new Error(`Session ${sessionId} non trouvée`);
      }

      if (updateSessionDto.ended_at) {
        const endedAt = new Date(updateSessionDto.ended_at);
        session.ended_at = endedAt;
        
        // Calculer la durée de la session
        const duration = Math.round((endedAt.getTime() - session.started_at.getTime()) / 1000); // en secondes
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        logger.log(`✅ [Analytics] Session expirée: ${sessionId} (${minutes}m ${seconds}s)`);
      }

      // Mettre à jour le statut de connexion si fourni
      // IMPORTANT : On ne met à jour que si on passe de false à true
      // Une fois à true, on ne revient jamais à false (même si l'utilisateur se déconnecte)
      // Cela permet de savoir si l'utilisateur s'est connecté à un moment donné pendant la session
      if (updateSessionDto.is_login !== undefined) {
        const previousStatus = session.is_login;
        
        // Ne mettre à jour que si on passe de false à true
        // Si déjà à true, on ne change rien
        if (updateSessionDto.is_login === true && previousStatus === false) {
          session.is_login = true;
          logger.log(`✅ [Analytics] Utilisateur connecté pendant la session`);
        }
        // Si déjà à true, on ne change rien (pas de log)
      }

      // Pas de log pour les mises à jour mineures

      const updatedSession = await this.sessionRepository.save(session);
      return updatedSession;
    } catch (error) {
      logger.error('❌ [Analytics] Erreur mise à jour session:', error);
      throw error;
    }
  }

  // Supprimer une session (et ses événements via CASCADE)
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findOne({ 
        where: { session_id: sessionId } 
      });

      if (!session) {
        logger.warn(`⚠️ [Analytics] Session ${sessionId} non trouvée pour suppression`);
        return;
      }

      // Supprimer la session (les événements seront supprimés automatiquement via CASCADE)
      await this.sessionRepository.remove(session);
      logger.log(`✅ [Analytics] Session supprimée: ${sessionId} (admin détecté)`);
    } catch (error) {
      logger.error('❌ [Analytics] Erreur suppression session:', error);
      throw error;
    }
  }

  // Créer un événement utilisateur
  async createUserEvent(createUserEventDto: CreateUserEventDto): Promise<UserEvent> {
    try {
      // Vérifier que le type d'événement existe
      const eventType = await this.eventTypeRepository.findOne({
        where: { code: createUserEventDto.event_type_code }
      });

      if (!eventType) {
        throw new Error(`Type d'événement ${createUserEventDto.event_type_code} non trouvé`);
      }

      if (!eventType.is_enabled) {
        logger.warn(`⚠️ [Analytics] Type d'événement ${createUserEventDto.event_type_code} désactivé`);
      }

      // Vérifier que la session existe
      const session = await this.sessionRepository.findOne({
        where: { session_id: createUserEventDto.session_id }
      });

      if (!session) {
        // Créer la session si elle n'existe pas (cas où le frontend envoie un événement avant la session)
        logger.warn(`⚠️ [Analytics] Session ${createUserEventDto.session_id} non trouvée, création automatique`);
        await this.createSession({
          session_id: createUserEventDto.session_id,
          started_at: createUserEventDto.event_ts || new Date().toISOString(),
        });
      }

      const userEvent = this.userEventRepository.create({
        session_id_Session: createUserEventDto.session_id,
        code_EventType: createUserEventDto.event_type_code,
        event_ts: createUserEventDto.event_ts ? new Date(createUserEventDto.event_ts) : new Date(),
        page_path: createUserEventDto.page_path || null,
        event_data: createUserEventDto.event_data || null,
      });

      const savedEvent = await this.userEventRepository.save(userEvent);
      logger.log(`✅ [Analytics] Événement: ${createUserEventDto.event_type_code}`);
      return savedEvent;
    } catch (error) {
      logger.error('❌ [Analytics] Erreur création événement:', error);
      throw error;
    }
  }

  // Récupérer les statistiques complètes
  async getStats(): Promise<any> {
    try {
      const totalSessions = await this.sessionRepository.count();
      const totalEvents = await this.userEventRepository.count();

      // ============================================
      // 1. Taux de rebond
      // ============================================
      // Pour utiliser les colonnes dans HAVING, on doit les inclure dans le SELECT
      const bounceSessionsResult = await this.sessionRepository
        .createQueryBuilder('session')
        .select('session.session_id', 'session_id')
        .addSelect('session.started_at', 'started_at')
        .addSelect('session.ended_at', 'ended_at')
        .addSelect('COUNT(event.event_id)', 'event_count')
        .leftJoin('session.userEvents', 'event')
        .where('event.code_EventType = :type', { type: 'page_view' })
        .groupBy('session.session_id')
        .having('COUNT(event.event_id) = 1')
        .andHaving('TIMESTAMPDIFF(SECOND, session.started_at, COALESCE(session.ended_at, NOW())) < 30')
        .getRawMany();
      
      const bounceSessions = bounceSessionsResult.length;

      const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0;

      // ============================================
      // 2. Taux de conversion global
      // ============================================
      const funnelStarted = await this.userEventRepository.count({
        where: { code_EventType: 'booking_funnel_started' }
      });

      const paymentSucceeded = await this.userEventRepository.count({
        where: { code_EventType: 'payment_succeeded' }
      });

      const conversionRate = funnelStarted > 0 ? (paymentSucceeded / funnelStarted) * 100 : 0;

      // ============================================
      // 3. Tunnel de réservation - Analyse par session
      // ============================================
      // Récupérer toutes les sessions qui ont commencé le tunnel
      const sessionsWithFunnelStarted = await this.userEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.session_id_Session', 'session_id')
        .where('event.code_EventType = :type', { type: 'booking_funnel_started' })
        .getRawMany();

      const sessionIds = sessionsWithFunnelStarted.map(s => s.session_id);
      
      // Pour chaque session, analyser son parcours
      const sessionAnalyses: Array<{
        sessionId: string;
        completed: boolean;
        lastStep: number;
        stepTimes: Record<number, number>; // Temps total passé sur chaque étape
        exitStep?: number; // Étape à laquelle la session a quitté (si abandon)
      }> = [];

      for (const sessionId of sessionIds) {
        // Récupérer tous les événements de cette session dans l'ordre chronologique
        const sessionEvents = await this.userEventRepository.find({
          where: { session_id_Session: sessionId },
          order: { event_ts: 'ASC' }
        });

        // Déterminer si complété
        const hasPaymentSucceeded = sessionEvents.some(e => e.code_EventType === 'payment_succeeded');
        
        // Trouver la dernière étape atteinte
        let lastStep = 0;
        const stepTimes: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        // Tous les événements liés au tunnel (steps, payment, abandon)
        const tunnelEvents = sessionEvents.filter(e => 
          e.code_EventType.startsWith('booking_step_') || 
          e.code_EventType === 'payment_succeeded' ||
          e.code_EventType === 'payment_button_clicked' ||
          e.code_EventType === 'booking_abandoned'
        );

        // Si une session a commencé le tunnel, elle a au moins atteint l'étape 1
        // Même si elle n'a pas d'événement booking_step_1 explicite
        lastStep = 1;

        // Trouver toutes les étapes visitées et calculer le temps passé
        const eventsByStep: Record<number, Array<{ ts: Date; type: string }>> = {};
        
        tunnelEvents.forEach(event => {
          if (event.code_EventType.startsWith('booking_step_')) {
            const stepNum = parseInt(event.code_EventType.replace('booking_step_', ''));
            if (!eventsByStep[stepNum]) eventsByStep[stepNum] = [];
            eventsByStep[stepNum].push({ ts: event.event_ts, type: event.code_EventType });
            if (stepNum > lastStep) lastStep = stepNum;
          }
        });

        // Calculer le temps passé sur chaque étape
        // On calcule le temps entre l'arrivée sur une étape et le passage à l'étape suivante
        // Seulement pour les sessions qui passent effectivement à l'étape suivante
        for (let step = 1; step <= 5; step++) {
          const stepEvents = eventsByStep[step] || [];
          if (stepEvents.length === 0) {
            stepTimes[step] = 0;
            continue;
          }

          // Trier les événements de cette étape par timestamp
          stepEvents.sort((a, b) => a.ts.getTime() - b.ts.getTime());
          
          // Trouver le premier événement de cette étape
          const firstStepEvent = stepEvents[0].ts;
          
          // Trouver le premier événement de l'étape suivante (si elle existe)
          let nextStepEvent: Date | null = null;
          
          if (step < 5) {
            const nextStepEvents = eventsByStep[step + 1] || [];
            if (nextStepEvents.length > 0) {
              nextStepEvents.sort((a, b) => a.ts.getTime() - b.ts.getTime());
              nextStepEvent = nextStepEvents[0].ts;
            }
          } else {
            // Pour l'étape 5, on cherche payment_succeeded (le succès du paiement)
            // On cherche le premier événement payment_succeeded qui vient après le premier événement de l'étape 5
            const paymentSucceededEvents = tunnelEvents
              .filter(e => e.code_EventType === 'payment_succeeded')
              .filter(e => e.event_ts > firstStepEvent)
              .sort((a, b) => a.event_ts.getTime() - b.event_ts.getTime());
            
            if (paymentSucceededEvents.length > 0) {
              nextStepEvent = paymentSucceededEvents[0].event_ts;
            }
          }
          
          // Si on a trouvé l'événement de l'étape suivante, calculer le temps
          if (nextStepEvent && nextStepEvent > firstStepEvent) {
            const timeDiff = Math.round((nextStepEvent.getTime() - firstStepEvent.getTime()) / 1000); // en secondes
            stepTimes[step] = timeDiff;
          } else {
            // Pas de passage à l'étape suivante, on ne peut pas calculer le temps
            stepTimes[step] = 0;
          }
        }

        // Trouver l'étape de sortie
        // Soit explicitement (booking_abandoned), soit implicitement (dernière étape atteinte sans aller plus loin)
        let exitStep: number | undefined;
        const abandonedEvent = sessionEvents.find(e => e.code_EventType === 'booking_abandoned');
        if (abandonedEvent) {
          exitStep = abandonedEvent.event_data?.step || lastStep;
        } else if (!hasPaymentSucceeded) {
          // Si pas complété et pas d'abandon explicite, la sortie est à la dernière étape atteinte
          exitStep = lastStep;
        }

        sessionAnalyses.push({
          sessionId,
          completed: hasPaymentSucceeded,
          lastStep,
          stepTimes,
          exitStep
        });
      }

      // Compter les sessions par étape atteinte
      const sessionsByStep: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const exitByStep: Record<number, number> = {};

      sessionAnalyses.forEach(analysis => {
        // Toutes les sessions qui ont commencé ont au moins atteint l'étape 1
        sessionsByStep[1]++;
        
        // Compter les sessions qui ont atteint les autres étapes
        for (let step = 2; step <= analysis.lastStep; step++) {
          sessionsByStep[step]++;
        }
        
        // Compter les sorties (explicites ou implicites)
        if (analysis.exitStep !== undefined) {
          exitByStep[analysis.exitStep] = (exitByStep[analysis.exitStep] || 0) + 1;
        }
      });

      const totalStarted = sessionIds.length;
      const reachedStep5 = sessionsByStep[5] || 0; // Nombre de sessions arrivées à l'étape 5
      const completionRate = totalStarted > 0 ? Math.round((reachedStep5 / totalStarted) * 10000) / 100 : 0;

      // Calculer les temps moyens par étape (basés sur les sessions)
      const averageTimeByStep: Record<number, number> = {};
      for (let step = 1; step <= 5; step++) {
        const times = sessionAnalyses
          .map(a => a.stepTimes[step])
          .filter(t => t > 0);
        
        if (times.length > 0) {
          const average = times.reduce((sum, t) => sum + t, 0) / times.length;
          averageTimeByStep[step] = Math.round(average * 100) / 100;
        } else {
          averageTimeByStep[step] = 0;
        }
      }

      // Statistiques Stripe (paiements)
      // Compter les sessions distinctes (pas les événements) pour éviter les doublons
      const paymentSucceededSessions = await this.userEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.session_id_Session', 'session_id')
        .where('event.code_EventType = :type', { type: 'payment_succeeded' })
        .getRawMany();
      const paymentSucceededCount = paymentSucceededSessions.length;

      const paymentFailedSessions = await this.userEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.session_id_Session', 'session_id')
        .where('event.code_EventType = :type', { type: 'payment_failed' })
        .getRawMany();
      const paymentFailedCount = paymentFailedSessions.length;

      const paymentButtonClickedSessions = await this.userEventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.session_id_Session', 'session_id')
        .where('event.code_EventType = :type', { type: 'payment_button_clicked' })
        .getRawMany();
      const paymentButtonClickedCount = paymentButtonClickedSessions.length;

      const totalPaymentAttempts = paymentSucceededCount + paymentFailedCount;
      const paymentSuccessRate = totalPaymentAttempts > 0 
        ? Math.round((paymentSucceededCount / totalPaymentAttempts) * 10000) / 100 
        : 0;
      const paymentFailureRate = totalPaymentAttempts > 0 
        ? Math.round((paymentFailedCount / totalPaymentAttempts) * 10000) / 100 
        : 0;

      // Taux de conversion entre l'étape 5 et le clic sur "Payer"
      const step5ToButtonClickRate = reachedStep5 > 0 
        ? Math.round((paymentButtonClickedCount / reachedStep5) * 10000) / 100 
        : 0;

      const paymentStats = {
        buttonClicked: paymentButtonClickedCount,
        succeeded: paymentSucceededCount,
        failed: paymentFailedCount,
        totalAttempts: totalPaymentAttempts,
        successRate: paymentSuccessRate,
        failureRate: paymentFailureRate,
        step5ToButtonClickRate, // % de personnes arrivées à l'étape 5 qui ont cliqué sur "Payer"
      };

      // Calculer les pourcentages par rapport au nombre total de sessions qui ont commencé
      const stepPercentages = {
        step1: totalStarted > 0 ? Math.round((sessionsByStep[1] / totalStarted) * 10000) / 100 : 0,
        step2: totalStarted > 0 ? Math.round((sessionsByStep[2] / totalStarted) * 10000) / 100 : 0,
        step3: totalStarted > 0 ? Math.round((sessionsByStep[3] / totalStarted) * 10000) / 100 : 0,
        step4: totalStarted > 0 ? Math.round((sessionsByStep[4] / totalStarted) * 10000) / 100 : 0,
        step5: totalStarted > 0 ? Math.round((sessionsByStep[5] / totalStarted) * 10000) / 100 : 0,
      };

      // Calculer les pourcentages pour les sorties par étape
      const totalExits = Object.values(exitByStep).reduce((sum, count) => sum + count, 0);
      const exitByStepWithPercentages: Record<number, { count: number; percentage: number }> = {};
      Object.entries(exitByStep).forEach(([step, count]) => {
        exitByStepWithPercentages[parseInt(step)] = {
          count: count,
          percentage: totalExits > 0 ? Math.round((count / totalExits) * 10000) / 100 : 0
        };
      });

      // Calculer aussi les taux de conversion entre étapes (pour référence)
      const conversionRates = {
        step1_to_step2: sessionsByStep[1] > 0 ? Math.round((sessionsByStep[2] / sessionsByStep[1]) * 10000) / 100 : 0,
        step2_to_step3: sessionsByStep[2] > 0 ? Math.round((sessionsByStep[3] / sessionsByStep[2]) * 10000) / 100 : 0,
        step3_to_step4: sessionsByStep[3] > 0 ? Math.round((sessionsByStep[4] / sessionsByStep[3]) * 10000) / 100 : 0,
        step4_to_step5: sessionsByStep[4] > 0 ? Math.round((sessionsByStep[5] / sessionsByStep[4]) * 10000) / 100 : 0,
      };

      const tunnelReservation = {
        started: totalStarted,
        completed: reachedStep5, // Nombre de sessions arrivées à l'étape 5 (pas ceux qui ont payé)
        completionRate: completionRate,
        sessionsByStep: {
          step1: sessionsByStep[1],
          step2: sessionsByStep[2],
          step3: sessionsByStep[3],
          step4: sessionsByStep[4],
          step5: sessionsByStep[5],
        },
        stepPercentages, // Pourcentage de sessions ayant atteint chaque étape par rapport au total
        conversionRates, // Taux de conversion entre étapes (pour référence)
        averageTimeByStep: {
          step1: averageTimeByStep[1],
          step2: averageTimeByStep[2],
          step3: averageTimeByStep[3],
          step4: averageTimeByStep[4],
          step5: averageTimeByStep[5],
        },
        exitByStep: exitByStepWithPercentages, // À quelle étape les sessions sortent (avec pourcentages)
      };

      // ============================================
      // 4. Point d'abandon
      // ============================================
      const abandonedEvents = await this.userEventRepository.find({
        where: { code_EventType: 'booking_abandoned' },
        relations: ['eventType']
      });

      // Compter les abandons par étape
      const abandonmentByStep: Record<number, number> = {};
      abandonedEvents.forEach(event => {
        const step = event.event_data?.step || 0;
        abandonmentByStep[step] = (abandonmentByStep[step] || 0) + 1;
      });

      // Trouver l'étape avec le plus d'abandons
      let maxAbandonStep = 0;
      let maxAbandonCount = 0;
      Object.entries(abandonmentByStep).forEach(([step, count]) => {
        if (count > maxAbandonCount) {
          maxAbandonCount = count;
          maxAbandonStep = parseInt(step);
        }
      });

      const totalAbandoned = abandonedEvents.length;
      const abandonmentPoint = {
        step: maxAbandonStep,
        count: maxAbandonCount,
        percentage: totalAbandoned > 0 ? Math.round((maxAbandonCount / totalAbandoned) * 10000) / 100 : 0
      };

      // Les temps médians par étape sont déjà calculés dans tunnelReservation

      // ============================================
      // 6. Répartition par device
      // ============================================
      const deviceStats = await this.sessionRepository
        .createQueryBuilder('session')
        .select('session.device_type', 'device')
        .addSelect('COUNT(*)', 'count')
        .where('session.device_type IS NOT NULL')
        .groupBy('session.device_type')
        .getRawMany();

      const deviceDistribution = {
        mobile: 0,
        desktop: 0,
        tablet: 0
      };

      const totalDevices = deviceStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);

      deviceStats.forEach(stat => {
        const device = stat.device?.toLowerCase();
        const count = parseInt(stat.count);
        if (device === 'mobile') deviceDistribution.mobile = count;
        else if (device === 'desktop') deviceDistribution.desktop = count;
        else if (device === 'tablet') deviceDistribution.tablet = count;
      });

      // Ajouter les pourcentages
      const deviceDistributionWithPercentages = {
        mobile: { count: deviceDistribution.mobile, percentage: totalDevices > 0 ? Math.round((deviceDistribution.mobile / totalDevices) * 10000) / 100 : 0 },
        desktop: { count: deviceDistribution.desktop, percentage: totalDevices > 0 ? Math.round((deviceDistribution.desktop / totalDevices) * 10000) / 100 : 0 },
        tablet: { count: deviceDistribution.tablet, percentage: totalDevices > 0 ? Math.round((deviceDistribution.tablet / totalDevices) * 10000) / 100 : 0 }
      };

      // ============================================
      // 7. Répartition par browser
      // ============================================
      const browserStats = await this.sessionRepository
        .createQueryBuilder('session')
        .select('session.browser', 'browser')
        .addSelect('COUNT(*)', 'count')
        .where('session.browser IS NOT NULL')
        .groupBy('session.browser')
        .getRawMany();

      const browserDistributionRaw: Record<string, number> = {};
      browserStats.forEach(stat => {
        browserDistributionRaw[stat.browser] = parseInt(stat.count);
      });

      const totalBrowsers = browserStats.reduce((sum, stat) => sum + parseInt(stat.count), 0);
      
      // Ajouter les pourcentages
      const browserDistribution: Record<string, { count: number; percentage: number }> = {};
      Object.entries(browserDistributionRaw).forEach(([browser, count]) => {
        browserDistribution[browser] = {
          count: count,
          percentage: totalBrowsers > 0 ? Math.round((count / totalBrowsers) * 10000) / 100 : 0
        };
      });

      // ============================================
      // 8. Taux de conversion par statut de connexion
      // ============================================
      // Compter les funnel_started et payment_succeeded par statut de connexion
      const loggedInFunnelStarted = await this.userEventRepository
        .createQueryBuilder('event')
        .innerJoin('event.session', 'session')
        .where('event.code_EventType = :type', { type: 'booking_funnel_started' })
        .andWhere('session.is_login = :isLogin', { isLogin: true })
        .getCount();

      const loggedInPaymentSucceeded = await this.userEventRepository
        .createQueryBuilder('event')
        .innerJoin('event.session', 'session')
        .where('event.code_EventType = :type', { type: 'payment_succeeded' })
        .andWhere('session.is_login = :isLogin', { isLogin: true })
        .getCount();

      const notLoggedInFunnelStarted = await this.userEventRepository
        .createQueryBuilder('event')
        .innerJoin('event.session', 'session')
        .where('event.code_EventType = :type', { type: 'booking_funnel_started' })
        .andWhere('session.is_login = :isLogin', { isLogin: false })
        .getCount();

      const notLoggedInPaymentSucceeded = await this.userEventRepository
        .createQueryBuilder('event')
        .innerJoin('event.session', 'session')
        .where('event.code_EventType = :type', { type: 'payment_succeeded' })
        .andWhere('session.is_login = :isLogin', { isLogin: false })
        .getCount();

      const conversionByLoginStatus = {
        loggedIn: {
          started: loggedInFunnelStarted,
          completed: loggedInPaymentSucceeded,
          rate: loggedInFunnelStarted > 0 ? Math.round((loggedInPaymentSucceeded / loggedInFunnelStarted) * 10000) / 100 : 0
        },
        notLoggedIn: {
          started: notLoggedInFunnelStarted,
          completed: notLoggedInPaymentSucceeded,
          rate: notLoggedInFunnelStarted > 0 ? Math.round((notLoggedInPaymentSucceeded / notLoggedInFunnelStarted) * 10000) / 100 : 0
        }
      };

      // ============================================
      // 9. Événements par type
      // ============================================
      const eventsByType = await this.userEventRepository
        .createQueryBuilder('event')
        .select('event.code_EventType', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('event.code_EventType')
        .getRawMany();

      const eventsByTypeMap: Record<string, number> = {};
      eventsByType.forEach(item => {
        eventsByTypeMap[item.type] = parseInt(item.count);
      });

      // ============================================
      // 10. Modales de retraites ouvertes (classées par retraite)
      // ============================================
      const retreatModalEvents = await this.userEventRepository.find({
        where: { code_EventType: 'retreat_modal_opened' },
        relations: ['eventType']
      });

      const retreatModalStats: Record<string, { count: number; retreat_title?: string }> = {};
      retreatModalEvents.forEach(event => {
        const retreatId = event.event_data?.retreat_id || 'unknown';
        const retreatTitle = event.event_data?.retreat_title || 'Retraite inconnue';
        if (!retreatModalStats[retreatId]) {
          retreatModalStats[retreatId] = { count: 0, retreat_title: retreatTitle };
        }
        retreatModalStats[retreatId].count++;
      });

      // Convertir en tableau et trier par nombre d'ouvertures
      const retreatModalStatsArray = Object.entries(retreatModalStats)
        .map(([retreatId, data]) => ({
          retreat_id: retreatId,
          retreat_title: data.retreat_title || 'Retraite inconnue',
          count: data.count
        }))
        .sort((a, b) => b.count - a.count);

      // ============================================
      // 11. Statistiques par statut de connexion
      // ============================================
      const sessionsWithLogin = await this.sessionRepository.count({
        where: { is_login: true }
      });

      const sessionsWithoutLogin = await this.sessionRepository.count({
        where: { is_login: false }
      });

      const loginStats = {
        withLogin: sessionsWithLogin,
        withoutLogin: sessionsWithoutLogin,
        total: totalSessions,
        withLoginPercentage: totalSessions > 0 ? Math.round((sessionsWithLogin / totalSessions) * 10000) / 100 : 0,
        withoutLoginPercentage: totalSessions > 0 ? Math.round((sessionsWithoutLogin / totalSessions) * 10000) / 100 : 0,
      };

      // ============================================
      // 12. Statistiques par page (pages les plus vues)
      // ============================================
      const pageViews = await this.userEventRepository
        .createQueryBuilder('event')
        .select('event.page_path', 'page')
        .addSelect('COUNT(*)', 'views')
        .where('event.code_EventType = :type', { type: 'page_view' })
        .andWhere('event.page_path IS NOT NULL')
        .groupBy('event.page_path')
        .orderBy('COUNT(*)', 'DESC')
        .getRawMany();

      const pageStats: Array<{ page: string; views: number; uniqueSessions: number; medianTimeOnPage: number; percentage: number }> = [];

      // Calculer le total de vues pour les pourcentages
      const totalViews = pageViews.reduce((sum, pv) => sum + parseInt(pv.views), 0);

      // Pour chaque page, calculer les stats détaillées
      for (const pageView of pageViews) {
        let pagePath = pageView.page;
        
        // Enlever les query params (tout ce qui suit "?")
        if (pagePath.includes('?')) {
          pagePath = pagePath.split('?')[0];
        }
        
        // Ignorer les pages avec des query params (on les a déjà filtrées ci-dessus)
        // Mais on continue à filtrer au cas où il y aurait des doublons
        
        const views = parseInt(pageView.views);

        // Nombre de sessions uniques ayant visité cette page (en utilisant LIKE pour matcher avec ou sans query params)
        const uniqueSessions = await this.userEventRepository
          .createQueryBuilder('event')
          .select('COUNT(DISTINCT event.session_id_Session)', 'count')
          .where('event.code_EventType = :type', { type: 'page_view' })
          .andWhere('event.page_path LIKE :pagePattern', { pagePattern: `${pagePath}%` })
          .getRawOne();

        // Temps médian passé sur cette page (en utilisant LIKE pour matcher avec ou sans query params)
        const timeDiffs = await this.userEventRepository
          .createQueryBuilder('page_view')
          .select('TIMESTAMPDIFF(SECOND, page_view.event_ts, page_exit.event_ts)', 'timeDiff')
          .innerJoin(
            'UserEvent',
            'page_exit',
            'page_view.session_id_Session = page_exit.session_id_Session AND page_exit.code_EventType = :exitType AND page_exit.page_path LIKE :pagePattern',
            { exitType: 'page_exit', pagePattern: `${pagePath}%` }
          )
          .where('page_view.code_EventType = :viewType', { viewType: 'page_view' })
          .andWhere('page_view.page_path LIKE :pagePattern', { pagePattern: `${pagePath}%` })
          .andWhere('page_exit.event_ts > page_view.event_ts')
          .getRawMany();

        const times = timeDiffs.map(t => parseFloat(t.timeDiff)).filter(t => !isNaN(t) && t > 0).sort((a, b) => a - b);
        const medianTime = times.length > 0 
          ? times.length % 2 === 0 
            ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
            : times[Math.floor(times.length / 2)]
          : 0;

        // Formater le nom de la page : enlever le "/" et remplacer "/" par "Accueil"
        let displayPage = pagePath;
        if (displayPage.startsWith('/')) {
          displayPage = displayPage.substring(1);
        }
        if (displayPage === '' || displayPage === '/') {
          displayPage = 'Accueil';
        }

        // Calculer le pourcentage de vues
        const percentage = totalViews > 0 ? Math.round((views / totalViews) * 10000) / 100 : 0;

        pageStats.push({
          page: displayPage,
          views: views,
          uniqueSessions: parseInt(uniqueSessions?.count || '0'),
          medianTimeOnPage: Math.round(medianTime * 100) / 100, // en secondes
          percentage
        });
      }

      // Filtrer les doublons et regrouper les pages avec query params
      // On regroupe par page sans query params et on additionne les vues
      const pageStatsMap = new Map<string, { page: string; views: number; uniqueSessions: number; medianTimeOnPage: number; percentage: number }>();
      
      for (const stat of pageStats) {
        const key = stat.page; // Déjà formaté sans query params
        
        if (pageStatsMap.has(key)) {
          const existing = pageStatsMap.get(key);
          if (existing) {
            existing.views += stat.views;
            // Pour les sessions uniques, on garde le max (car on compte déjà les sessions distinctes)
            existing.uniqueSessions = Math.max(existing.uniqueSessions, stat.uniqueSessions);
            // Pour le temps médian, on pourrait faire une moyenne pondérée, mais pour simplifier on garde le premier
          }
        } else {
          pageStatsMap.set(key, { ...stat });
        }
      }

      // Recalculer les pourcentages après regroupement
      const totalViewsAfterGrouping = Array.from(pageStatsMap.values()).reduce((sum, stat) => sum + stat.views, 0);
      const filteredPageStats = Array.from(pageStatsMap.values()).map(stat => ({
        ...stat,
        percentage: totalViewsAfterGrouping > 0 ? Math.round((stat.views / totalViewsAfterGrouping) * 10000) / 100 : 0
      })).sort((a, b) => b.views - a.views);

      return {
        totalSessions,
        totalEvents,
        bounceRate: Math.round(bounceRate * 100) / 100,
        conversionRate: Math.round(conversionRate * 100) / 100,
        eventsByType: eventsByTypeMap,
        tunnelReservation, // Renommé de funnelConversion, avec analyse par session
        abandonmentPoint,
        deviceDistribution: deviceDistributionWithPercentages, // Avec pourcentages
        browserDistribution, // Avec pourcentages
        conversionByLoginStatus,
        pageStats: filteredPageStats, // Avec temps médian et pourcentages
        retreatModalStats: retreatModalStatsArray, // Stats modales retraites
        loginStats, // Stats sessions connectées/non connectées
        paymentStats, // Stats Stripe (paiements réussis/échoués)
      };
    } catch (error) {
      logger.error('❌ [Analytics] Erreur récupération stats:', error);
      throw error;
    }
  }

  // Récupérer tous les types d'événements
  async getEventTypes(): Promise<EventType[]> {
    return this.eventTypeRepository.find({
      where: { is_enabled: true },
      order: { category: 'ASC', label: 'ASC' }
    });
  }

  // Vider toute la base de données analytics (sessions et événements uniquement)
  // Note: Ne supprime PAS les EventType (données de configuration)
  // Note: Ne touche PAS à MongoDB (uniquement MySQL analytics)
  async clearAllData(): Promise<{ deletedSessions: number; deletedEvents: number }> {
    try {
      // Compter avant suppression pour le log
      const sessionsCount = await this.sessionRepository.count();
      const eventsCount = await this.userEventRepository.count();

      // Supprimer tous les événements utilisateur (UserEvent)
      // Les sessions seront supprimées ensuite
      // On ne touche PAS aux EventType (ce sont des données de configuration)
      await this.userEventRepository
        .createQueryBuilder()
        .delete()
        .from(UserEvent)
        .execute();

      // Supprimer toutes les sessions
      await this.sessionRepository
        .createQueryBuilder()
        .delete()
        .from(Session)
        .execute();

      logger.log(`🗑️ [Analytics] Base MySQL vidée : ${sessionsCount} sessions et ${eventsCount} événements supprimés (EventType conservés)`);

      return {
        deletedSessions: sessionsCount,
        deletedEvents: eventsCount
      };
    } catch (error) {
      logger.error('❌ [Analytics] Erreur lors de la suppression des données:', error);
      throw error;
    }
  }
}