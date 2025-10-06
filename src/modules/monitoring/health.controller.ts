import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../common/database/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * Health Check Controller
 * Provides health status for monitoring and load balancers
 */
@ApiTags('monitoring')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Basic health check
   * Returns 200 OK if service is running
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }

  /**
   * Detailed health check with dependencies
   * Checks database, Redis, etc.
   */
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with dependencies' })
  @ApiResponse({ status: 200, description: 'All systems operational' })
  @ApiResponse({ status: 503, description: 'Service unavailable' })
  async getDetailedHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV'),
      checks: {
        database: await this.checkDatabase(),
        memory: this.checkMemory(),
      },
    };

    const allHealthy = Object.values(health.checks).every(check => check.status === 'ok');
    
    return {
      ...health,
      status: allHealthy ? 'ok' : 'degraded',
    };
  }

  /**
   * Readiness check for Kubernetes/Docker
   * Returns 200 when ready to accept traffic
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 500, description: 'Service not ready' })
  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (error) {
      throw new Error('Service not ready');
    }
  }

  /**
   * Liveness check for Kubernetes/Docker
   * Returns 200 if process is alive
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness() {
    return { status: 'alive' };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', message: 'Database connected' };
    } catch (error) {
      return { status: 'error', message: 'Database connection failed' };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory() {
    const used = process.memoryUsage();
    const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
    const rssMB = Math.round(used.rss / 1024 / 1024);

    return {
      status: heapUsedMB < 512 ? 'ok' : 'warning',
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${rssMB}MB`,
    };
  }
}
