import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsObject,
  IsBoolean,
  IsEnum,
  IsDateString
} from 'class-validator';

// DTO pour créer une session
export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  session_id: string;

  @IsDateString()
  @IsNotEmpty()
  started_at: string;

  @IsString()
  @IsOptional()
  browser?: string;

  @IsEnum(['mobile', 'desktop', 'tablet'])
  @IsOptional()
  device_type?: 'mobile' | 'desktop' | 'tablet';

  @IsBoolean()
  @IsOptional()
  is_login?: boolean;
}

// DTO pour mettre à jour une session (fin de session ou changement de statut login)
export class UpdateSessionDto {
  @IsDateString()
  @IsOptional()
  ended_at?: string;

  @IsBoolean()
  @IsOptional()
  is_login?: boolean;
}

// DTO pour créer un événement
export class CreateUserEventDto {
  @IsString()
  @IsNotEmpty()
  session_id: string;

  @IsString()
  @IsNotEmpty()
  event_type_code: string;

  @IsDateString()
  @IsOptional()
  event_ts?: string;

  @IsString()
  @IsOptional()
  page_path?: string;

  @IsObject()
  @IsOptional()
  event_data?: Record<string, any>;
}

// DTO pour les statistiques (réponse)
export class AnalyticsStatsDto {
  totalSessions: number;
  totalEvents: number;
  bounceRate: number;
  conversionRate: number;
  eventsByType: Record<string, number>;
  funnelConversion: {
    step1: number;
    step2: number;
    step3: number;
    step4: number;
    step5: number;
    conversionRates: {
      step1_to_step2: number;
      step2_to_step3: number;
      step3_to_step4: number;
      step4_to_step5: number;
      step5_to_payment: number;
    };
  };
  abandonmentPoint: {
    step: number;
    count: number;
    percentage: number;
  };
  averageTimeByStep: {
    step1: number;
    step2: number;
    step3: number;
    step4: number;
    step5: number;
  };
  deviceDistribution: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  browserDistribution: Record<string, number>;
  conversionByLoginStatus: {
    loggedIn: {
      started: number;
      completed: number;
      rate: number;
    };
    notLoggedIn: {
      started: number;
      completed: number;
      rate: number;
    };
  };
  pageStats: Array<{
    page: string;
    views: number;
    uniqueSessions: number;
    avgTimeOnPage: number; // en secondes
  }>;
}

