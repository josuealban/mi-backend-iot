// src/users/dto/change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({
        example: 'currentPassword123',
        description: 'Contraseña actual del usuario',
        required: true
    })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({
        example: 'newPassword123',
        description: 'Nueva contraseña del usuario (mínimo 8 caracteres)',
        required: true
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}