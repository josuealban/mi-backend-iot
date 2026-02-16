import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateDeviceSettingsDto {
    @ApiProperty({ example: 300.0, description: 'Umbral MQ2 (LPG/Humo)', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq2ThresholdPpm?: number;

    @ApiProperty({ example: 150.0, description: 'Umbral MQ3 (Alcohol)', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq3ThresholdPpm?: number;

    @ApiProperty({ example: 200.0, description: 'Umbral MQ5 (Metano)', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq5ThresholdPpm?: number;

    @ApiProperty({ example: 100.0, description: 'Umbral MQ9 (Monóxido)', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq9ThresholdPpm?: number;

    @ApiProperty({ example: 5.5, description: 'Calibración R0 MQ2', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq2R0?: number;

    @ApiProperty({ example: 2.0, description: 'Calibración R0 MQ3', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq3R0?: number;

    @ApiProperty({ example: 20.0, description: 'Calibración R0 MQ5', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq5R0?: number;

    @ApiProperty({ example: 12.0, description: 'Calibración R0 MQ9', required: false })
    @IsNumber() @IsOptional() @Min(0)
    mq9R0?: number;

    @ApiProperty({ example: true, description: 'Activar/desactivar buzzer', required: false })
    @IsBoolean() @IsOptional()
    buzzerEnabled?: boolean;

    @ApiProperty({ example: true, description: 'Activar/desactivar LED', required: false })
    @IsBoolean() @IsOptional()
    ledEnabled?: boolean;

    @ApiProperty({ example: true, description: 'Notificar al usuario', required: false })
    @IsBoolean() @IsOptional()
    notifyUser?: boolean;

    @ApiProperty({ example: 300, description: 'Tiempo de espera entre notificaciones', required: false })
    @IsNumber() @IsOptional() @Min(0)
    notificationCooldown?: number;

    @ApiProperty({ example: false, description: 'Cierre automático', required: false })
    @IsBoolean() @IsOptional()
    autoShutoff?: boolean;
}

export class UpdateDeviceSettingsDto extends CreateDeviceSettingsDto { }
