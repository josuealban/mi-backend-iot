import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class SensorReadingDto {
    @IsNotEmpty()
    @IsString()
    deviceKey: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(4095)
    rawValue: number;

    @IsOptional()
    @IsNumber()
    voltage?: number;

    @IsOptional()
    @IsNumber()
    gasConcentrationPpm?: number;

    @IsOptional()
    @IsNumber()
    rsRoRatio?: number;

    @IsOptional()
    @IsNumber()
    temperature?: number;

    @IsOptional()
    @IsNumber()
    humidity?: number;
}
