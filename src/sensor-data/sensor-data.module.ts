import { Module } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { SensorDataController } from './sensor-data.controller';
import { SensorGateway } from './sensor.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SensorDataController],
  providers: [SensorDataService, SensorGateway],
  exports: [SensorDataService],
})
export class SensorDataModule { }
