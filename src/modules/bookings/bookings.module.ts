import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsCronService } from './bookings.cron';
import { Booking, BookingSchema } from './bookings.schema';
import { Retreat, RetreatSchema } from '../retreats/retreats.schema';
import { User, UserSchema } from '../users/users.schema';
import { StripeModule } from '../stripe/stripe.module';
import { EmailModule } from '../email/email.module';
import { PdfGeneratorService } from '../email/pdf-generator.service';
import { EmailService } from '../email/email.service';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Retreat.name, schema: RetreatSchema },
      { name: User.name, schema: UserSchema }
    ]),
    forwardRef(() => StripeModule),
    EmailModule,
    UsersModule,
    AuthModule
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsCronService, PdfGeneratorService, EmailService, AdminGuard],
  exports: [BookingsService]
})
export class BookingsModule {}