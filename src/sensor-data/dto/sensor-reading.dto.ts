import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GasAlertDto {
    @IsNotEmpty()
    @IsString()
    deviceKey: string;

    @IsNotEmpty()
    @IsString()
    gasType: string; // LPG, METHANE, ALCOHOL, CO, SMOKE

    @IsNotEmpty()
    @IsString()
    sensorSource: string; // MQ2, MQ3, MQ5, MQ9

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    gasConcentrationPpm: number;

    @IsOptional()
    @IsNumber()
    voltage?: number;

    @IsOptional()
    @IsNumber()
    rawValue?: number;

    @IsOptional()
    @IsNumber()
    temperature?: number;

    @IsOptional()
    @IsNumber()
    humidity?: number;
}
