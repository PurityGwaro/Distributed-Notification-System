import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  Inject,
  HttpCode,
  HttpStatus,
  HttpException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginDto } from '../dto/login.dto';

@ApiTags('users')
@Controller('api/v1/users')
export class UserProxyController {
  constructor(
    @Inject('USER_SERVICE') private readonly userServiceClient: ClientProxy,
  ) {}

  private handleRpcError(error: any) {
    console.error('RPC Error:', error);

    // Extract error details from RpcException
    // RpcException can be structured as error.error or directly as error
    const errorData = error.error || error;
    const statusCode = errorData.statusCode || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = errorData.message || error.message || 'An error occurred';

    // Map status codes to appropriate HTTP exceptions
    if (statusCode === HttpStatus.NOT_FOUND) {
      throw new NotFoundException(message);
    } else if (statusCode === HttpStatus.CONFLICT) {
      throw new ConflictException(message);
    } else if (statusCode === HttpStatus.UNAUTHORIZED) {
      throw new UnauthorizedException(message);
    } else if (statusCode === HttpStatus.BAD_REQUEST) {
      throw new BadRequestException(message);
    } else {
      throw new HttpException(message, statusCode);
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() createUserDto: CreateUserDto) {
    try {
      const response = await firstValueFrom(
        this.userServiceClient.send({ cmd: 'create_user' }, createUserDto),
      );
      return response;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    try {
      const response = await firstValueFrom(
        this.userServiceClient.send(
          { cmd: 'get_users' },
          {
            page: page ? parseInt(page.toString()) : 1,
            limit: limit ? parseInt(limit.toString()) : 10,
          },
        ),
      );
      return response;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    try {
      const response = await firstValueFrom(
        this.userServiceClient.send({ cmd: 'get_user' }, { id }),
      );
      return response;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() updateUserDto: any) {
    try {
      const response = await firstValueFrom(
        this.userServiceClient.send(
          { cmd: 'update_user' },
          { id, ...updateUserDto },
        ),
      );
      return response;
    } catch (error) {
      this.handleRpcError(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string) {
    try {
      await firstValueFrom(
        this.userServiceClient.send({ cmd: 'delete_user' }, { id }),
      );
    } catch (error) {
      this.handleRpcError(error);
    }
  }
}
