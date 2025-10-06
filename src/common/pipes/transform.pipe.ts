import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Parse and validate UUID pipe
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!isUUID(value)) {
      throw new BadRequestException('Invalid UUID format');
    }
    return value;
  }
}

/**
 * Parse integer pipe with validation
 */
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  constructor(private readonly min?: number, private readonly max?: number) {}

  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Invalid integer value');
    }

    if (this.min !== undefined && val < this.min) {
      throw new BadRequestException(`Value must be at least ${this.min}`);
    }

    if (this.max !== undefined && val > this.max) {
      throw new BadRequestException(`Value must be at most ${this.max}`);
    }

    return val;
  }
}