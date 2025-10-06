import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

/**
 * WebSockets Module
 * Handles real-time events, notifications, and live updates for CTF platform
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: configService.get<string>('auth.jwtExpiresIn'),
        },
      }),
    }),
  ],
  providers: [EventsGateway, EventsService],
  exports: [EventsService, EventsGateway],
})
export class WebsocketsModule {}