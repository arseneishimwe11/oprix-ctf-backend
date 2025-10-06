import { Module } from '@nestjs/common';
import { SuperadminService } from './superadmin.service';
import { SuperadminController } from './superadmin.controller';
import { DatabaseModule } from '../../common/database/database.module';
import { CryptoService } from '../../common/services/crypto.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SuperadminController],
  providers: [SuperadminService, CryptoService],
  exports: [SuperadminService],
})
export class SuperadminModule {}
