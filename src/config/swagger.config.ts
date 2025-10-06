import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CTF Platform API')
    .setDescription(
      'APIs for CTF (Capture The Flag) competition management platform. ' +
      'Handles authentication, competitions, challenges, submissions, and real-time leaderboards.'
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication and authorization')
    .addTag('users', 'User management')
    .addTag('competitions', 'Competition management')
    .addTag('challenges', 'Challenge management')
    .addTag('submissions', 'Flag submissions')
    .addTag('leaderboard', 'Leaderboard and scoring')
    .addTag('teams', 'Team management')
    .addTag('files', 'File uploads and downloads')
    .addTag('admin', 'Admin operations (CTF organizers)')
    .addTag('superadmin', 'SuperAdmin operations (platform owners)')
    .addTag('monitoring', 'Health checks and monitoring')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token from Clerk',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document, {
    customSiteTitle: 'CTF Platform API Docs',
    customfavIcon: 'https://nestjs.com/img/logo_text.svg',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });
}