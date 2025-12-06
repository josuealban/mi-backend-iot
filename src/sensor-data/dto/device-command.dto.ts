import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceCommandDto {
    @IsNotEmpty()
    @IsString()
    deviceKey: string;

    @IsOptional()
    @IsBoolean()
    ledState?: boolean;

    @IsOptional()
    @IsBoolean()
    buzzerState?: boolean;

    @IsOptional()
    @IsString()
    message?: string;
}
