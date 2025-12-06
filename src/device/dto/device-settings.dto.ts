import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateDeviceSettingsDto {
    @ApiProperty({
        example: 300.0,
        description: 'Umbral de concentración de gas en PPM',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(0)
    gasThresholdPpm?: number;

    @ApiProperty({
        example: 1.5,
        description: 'Umbral de voltaje',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(0)
    voltageThreshold?: number;

    @ApiProperty({
        example: true,
        description: 'Activar/desactivar buzzer',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    buzzerEnabled?: boolean;

    @ApiProperty({
        example: true,
        description: 'Activar/desactivar LED',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    ledEnabled?: boolean;

    @ApiProperty({
        example: true,
        description: 'Notificar al usuario',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    notifyUser?: boolean;

    @ApiProperty({
        example: 300,
        description: 'Tiempo de espera entre notificaciones (segundos)',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(0)
    notificationCooldown?: number;

    @ApiProperty({
        example: false,
        description: 'Apagar automáticamente al superar umbral',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    autoShutoff?: boolean;

    @ApiProperty({
        example: 10.0,
        description: 'Valor R0 de calibración del sensor',
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(0)
    calibrationR0?: number;
}

export class UpdateDeviceSettingsDto extends CreateDeviceSettingsDto { }
