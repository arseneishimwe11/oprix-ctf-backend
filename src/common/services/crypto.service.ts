import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Cryptographic Service for Security Operations
 * Handles:
 * - Secure flag hashing and validation with constant-time comparison
 * - Password hashing with bcrypt
 * - Random token generation
 */
@Injectable()
export class CryptoService {
  private readonly HASH_ALGORITHM = 'sha256';
  private readonly SALT_ROUNDS = 12;
  private readonly BCRYPT_ROUNDS = 10;

  /**
   * Hash a flag securely with salt
   * @param flag - The flag to hash
   * @param salt - Optional salt (generates random if not provided)
   * @returns Object containing hash and salt
   */
  hashFlag(flag: string, salt?: string): { hash: string; salt: string } {
    // Normalize flag (trim whitespace, optionally convert case)
    const normalizedFlag = this.normalizeFlag(flag);
    
    // Generate salt if not provided
    const flagSalt = salt || crypto.randomBytes(32).toString('hex');
    
    // Create hash with salt
    const hash = crypto
      .createHash(this.HASH_ALGORITHM)
      .update(normalizedFlag + flagSalt)
      .digest('hex');

    return { hash, salt: flagSalt };
  }

  /**
   * Verify flag against stored hash using constant-time comparison
   * @param submittedFlag - Flag submitted by user
   * @param storedHash - Stored hash from database
   * @param storedSalt - Stored salt from database
   * @param caseSensitive - Whether comparison should be case sensitive
   * @returns boolean indicating if flag is correct
   */
  verifyFlag(
    submittedFlag: string, 
    storedHash: string, 
    storedSalt: string, 
    caseSensitive: boolean = false
  ): boolean {
    try {
      // Normalize submitted flag
      const normalizedSubmitted = this.normalizeFlag(submittedFlag, caseSensitive);
      
      // Hash the submitted flag with stored salt
      const submittedHash = crypto
        .createHash(this.HASH_ALGORITHM)
        .update(normalizedSubmitted + storedSalt)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(submittedHash, storedHash);
    } catch (error) {
      // If any error occurs during verification, return false
      return false;
    }
  }

  /**
   * Normalize flag based on configuration
   * @param flag - Flag to normalize
   * @param caseSensitive - Whether to preserve case
   * @returns normalized flag
   */
  private normalizeFlag(flag: string, caseSensitive: boolean = false): string {
    // Always trim whitespace
    let normalized = flag.trim();
    
    // Convert case if not case sensitive
    if (!caseSensitive) {
      normalized = normalized.toLowerCase();
    }
    
    return normalized;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns boolean indicating equality
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Generate a random salt
   * @param bytes - Number of bytes for salt (default: 32)
   * @returns hex-encoded salt
   */
  generateSalt(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate secure random string for invite codes, tokens, etc.
   * @param length - Length of the generated string
   * @returns random string
   */
  generateSecureRandom(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex').substring(0, length);
  }

  /**
   * Hash sensitive data (not flags) like API keys, tokens
   * @param data - Data to hash
   * @returns hash string
   */
  hashSensitiveData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Hash password using bcrypt
   * @param password - Plain text password
   * @returns Promise with hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.BCRYPT_ROUNDS);
  }

  /**
   * Verify password against bcrypt hash
   * @param password - Plain text password
   * @param hash - Stored bcrypt hash
   * @returns Promise with boolean indicating match
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Alias for verifyPassword (for consistency)
   * @param password - Plain text password
   * @param hash - Stored bcrypt hash
   * @returns Promise with boolean indicating match
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.verifyPassword(password, hash);
  }

  /**
   * Generate secure token for setup/handover processes
   * @param length - Length of token (default: 32 bytes = 64 hex chars)
   * @returns secure hex token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate URL-safe secure token
   * @param length - Length of token in bytes
   * @returns base64url encoded token
   */
  generateUrlSafeToken(length: number = 32): string {
    return crypto.randomBytes(length)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
