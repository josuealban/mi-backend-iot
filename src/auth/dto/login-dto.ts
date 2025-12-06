import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class LoginDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'Email del usuario',
        required: true
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'password123',
        description: 'Contraseña del usuario',
        required: true
    })
    @IsString()
    password: string;
}