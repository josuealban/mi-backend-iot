import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, Min, MinLength } from "class-validator";

export class CreateUserDto {

    @ApiProperty({
        example: 'John Doe',
        description: 'User name',
        required: true
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'User email',
        required: true
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'jajsfia7f8&!*)29@',
        description: 'User password',
        required: true
    })
    @IsString()
    @IsNotEmpty()
    @Min(8)
    password: string;
}
