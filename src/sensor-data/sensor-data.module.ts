import { Module } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { SensorDataGateway } from './sensor-data.gateway';
import { SensorDataWebSocketGateway } from './sensor-data-websocket.gateway';
import { SensorDataController } from './sensor-data.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SensorDataController],
  providers: [SensorDataGateway, SensorDataWebSocketGateway, SensorDataService],
  exports: [SensorDataService, SensorDataGateway, SensorDataWebSocketGateway],
})
export class SensorDataModule { }
