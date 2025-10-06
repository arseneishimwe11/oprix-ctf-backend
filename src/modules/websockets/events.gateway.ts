import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/database/prisma.service';

/**
 * WebSocket Gateway for real-time CTF events
 * Handles live leaderboard updates, notifications, and competition events
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connectedUsers = new Map<string, { userId: string; competitionId?: string }>();

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, username: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }

      this.connectedUsers.set(client.id, { userId: user.id });
      client.join(`user:${user.id}`);
      
      this.logger.log(`User ${user.username} connected (${client.id})`);
      
      // Send initial connection confirmation
      client.emit('connected', {
        message: 'Connected to CTF real-time events',
        userId: user.id,
        username: user.username,
      });
    } catch (error) {
      this.logger.error('Connection authentication failed', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (userInfo) {
      this.logger.log(`User disconnected (${client.id})`);
      this.connectedUsers.delete(client.id);
    }
  }

  /**
   * Join competition room for real-time updates
   */
  @SubscribeMessage('join-competition')
  async handleJoinCompetition(
    @MessageBody() data: { competitionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo) return;

    try {
      // Verify user is registered for competition
      const registration = await this.prisma.registration.findFirst({
        where: {
          userId: userInfo.userId,
          competitionId: data.competitionId,
          status: 'APPROVED',
        },
      });

      if (!registration) {
        client.emit('error', { message: 'Not registered for this competition' });
        return;
      }

      // Leave previous competition room if any
      const rooms = Array.from(client.rooms);
      const prevCompRoom = rooms.find(room => room.startsWith('competition:'));
      if (prevCompRoom) {
        client.leave(prevCompRoom);
      }

      // Join new competition room
      const roomName = `competition:${data.competitionId}`;
      client.join(roomName);
      
      // Update user info
      this.connectedUsers.set(client.id, { 
        ...userInfo, 
        competitionId: data.competitionId 
      });

      this.logger.log(`User ${userInfo.userId} joined competition ${data.competitionId}`);
      
      client.emit('joined-competition', {
        competitionId: data.competitionId,
        message: 'Joined competition room',
      });

      // Send current leaderboard
      await this.sendLeaderboardUpdate(data.competitionId);
    } catch (error) {
      this.logger.error('Failed to join competition', error);
      client.emit('error', { message: 'Failed to join competition' });
    }
  }

  /**
   * Leave competition room
   */
  @SubscribeMessage('leave-competition')
  handleLeaveCompetition(@ConnectedSocket() client: Socket) {
    const userInfo = this.connectedUsers.get(client.id);
    if (!userInfo?.competitionId) return;

    const roomName = `competition:${userInfo.competitionId}`;
    client.leave(roomName);
    
    this.connectedUsers.set(client.id, { userId: userInfo.userId });
    
    client.emit('left-competition', { 
      competitionId: userInfo.competitionId,
      message: 'Left competition room' 
    });
  }

  /**
   * Send live leaderboard update to competition room
   */
  async sendLeaderboardUpdate(competitionId: string) {
    try {
      // Get top 10 for live updates
      const leaderboard = await this.getCompetitionLeaderboard(competitionId, 10);
      
      this.server.to(`competition:${competitionId}`).emit('leaderboard-update', {
        competitionId,
        leaderboard,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to send leaderboard update', error);
    }
  }

  /**
   * Send flag submission result to user
   */
  async sendSubmissionResult(userId: string, submission: any) {
    this.server.to(`user:${userId}`).emit('submission-result', {
      submissionId: submission.id,
      challengeId: submission.challengeId,
      isCorrect: submission.isCorrect,
      points: submission.points || 0,
      message: submission.isCorrect ? 'Correct flag! 🎉' : 'Incorrect flag. Try again! 💪',
      timestamp: new Date(),
    });

    // If correct and in competition, update leaderboard
    if (submission.isCorrect && submission.competitionId) {
      await this.sendLeaderboardUpdate(submission.competitionId);
    }
  }

  /**
   * Send first blood notification to competition
   */
  // async sendFirstBloodNotification(competitionId: string, challenge: any, user: any) {
  //   this.server.to(`competition:${competitionId}`).emit('first-blood', {
  //     challengeId: challenge.id,
  //     challengeTitle: challenge.title,
  //     userId: user.id,
  //     username: user.username,
  //     points: challenge.points,
  //     message: `${user.username} got first blood on "${challenge.title}"!`,
  //     timestamp: new Date(),
  //   });

  //   this.logger.log(`First blood: ${user.username} on ${challenge.title}`);
  // }

  /**
   * Send competition status change
   */
  async sendCompetitionStatusChange(competitionId: string, status: string, message?: string) {
    this.server.to(`competition:${competitionId}`).emit('competition-status', {
      competitionId,
      status,
      message: message || `Competition status changed to ${status}`,
      timestamp: new Date(),
    });

    this.logger.log(`Competition ${competitionId} status changed to ${status}`);
  }

  /**
   * Send new challenge notification
   */
  async sendNewChallengeNotification(competitionId: string, challenge: any) {
    this.server.to(`competition:${competitionId}`).emit('new-challenge', {
      challengeId: challenge.id,
      title: challenge.title,
      category: challenge.category,
      difficulty: challenge.difficulty,
      points: challenge.points,
      message: `New challenge released: "${challenge.title}"`,
      timestamp: new Date(),
    });
  }

  /**
   * Send general notification to user
   */
  async sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      priority: notification.priority,
      timestamp: notification.createdAt,
    });
  }

  /**
   * Send announcement to competition
   */
  async sendAnnouncementToCompetition(competitionId: string, announcement: any) {
    this.server.to(`competition:${competitionId}`).emit('announcement', {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      timestamp: announcement.createdAt,
    });
  }

  /**
   * Send team invitation
   */
  async sendTeamInvitation(userId: string, team: any, inviterUsername: string) {
    this.server.to(`user:${userId}`).emit('team-invitation', {
      teamId: team.id,
      teamName: team.name,
      inviterUsername,
      message: `${inviterUsername} invited you to join team "${team.name}"`,
      timestamp: new Date(),
    });
  }

  /**
   * Get competition leaderboard for real-time updates
   */
  private async getCompetitionLeaderboard(competitionId: string, limit: number = 10) {
    // Get user scores for the competition
    const userScores = await this.prisma.score.groupBy({
      by: ['userId'],
      where: { competitionId },
      _sum: { points: true },
      _count: { id: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    // Get user details
    const leaderboard = await Promise.all(
      userScores
        .filter(score => score.userId !== null)
        .map(async (score, index) => {
        const user = await this.prisma.user.findUnique({
          where: { id: score.userId! },
          select: { id: true, username: true },
        });

        const lastSolve = await this.prisma.submission.findFirst({
          where: {
            userId: score.userId!,
            competitionId,
            isCorrect: true,
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          rank: index + 1,
          user: {
            id: user?.id,
            username: user?.username,
          },
          totalPoints: score._sum.points || 0,
          solveCount: score._count.id,
          lastSolveTime: lastSolve?.createdAt,
        };
      }),
    );

    return leaderboard;
  }

  /**
   * Get connected users count for competition
   */
  getConnectedUsersCount(competitionId?: string): number {
    if (!competitionId) {
      return this.connectedUsers.size;
    }
    
    let count = 0;
    this.connectedUsers.forEach(userInfo => {
      if (userInfo.competitionId === competitionId) count++;
    });
    
    return count;
  }

  /**
   * Broadcast system maintenance message
   */
  async broadcastMaintenanceMessage(message: string) {
    this.server.emit('system-maintenance', {
      message,
      timestamp: new Date(),
    });
  }
}