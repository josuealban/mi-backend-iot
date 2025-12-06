import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator"

export class CreateDeviceDto {

    @ApiProperty({
        example: 'Sensor de temperatura',
        description: 'Nombre del dispositivo',
        required: true
    })
    @IsString()
    @IsNotEmpty()
    name: string

    @ApiProperty({
        example: 'Sensor para monitorear temperatura ambiente',
        description: 'Descripción del dispositivo',
        required: false
    })
    @IsString()
    @IsOptional()
    description?: string

    @ApiProperty({
        example: 'Sala principal',
        description: 'Ubicación del dispositivo',
        required: false
    })
    @IsString()
    @IsOptional()
    location?: string
}

