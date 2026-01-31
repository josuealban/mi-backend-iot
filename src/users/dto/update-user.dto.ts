// src/users/dto/update-user.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
    @ApiProperty({
        example: 'John Doe Updated',
        description: 'Nuevo nombre de usuario',
        required: false
    })
    @IsString()
    @IsOptional()
    @MinLength(3)
    username?: string;

    @ApiProperty({
        example: 'john.updated@example.com',
        description: 'Nuevo email del usuario',
        required: false
    })
    @IsEmail()
    @IsOptional()
    email?: string;
}