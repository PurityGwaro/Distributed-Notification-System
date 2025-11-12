import { Controller, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  private handleError(error: any) {
    console.error('User service error:', error);

    const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || 'An error occurred';

    throw new RpcException({
      statusCode,
      message,
      error: error.name || 'Error',
    });
  }

  @MessagePattern({ cmd: 'create_user' })
  async create(@Payload() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return {
        success: true,
        message: 'User created successfully',
        data: result,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern({ cmd: 'get_users' })
  async findAll(@Payload() data: { page: number; limit: number }) {
    try {
      const result = await this.userService.findAll(data.page, data.limit);
      return {
        success: true,
        message: 'Users retrieved successfully',
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern({ cmd: 'get_user' })
  async findOne(@Payload() data: { id: string }) {
    try {
      const user = await this.userService.findOne(data.id);
      return {
        success: true,
        message: 'User retrieved successfully',
        data: user,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern({ cmd: 'update_user' })
  async update(@Payload() data: { id: string } & UpdateUserDto) {
    try {
      const { id, ...updateUserDto } = data;
      const user = await this.userService.update(id, updateUserDto);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return {
        success: true,
        message: 'User updated successfully',
        data: result,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @MessagePattern({ cmd: 'delete_user' })
  async remove(@Payload() data: { id: string }) {
    try {
      await this.userService.remove(data.id);
      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      this.handleError(error);
    }
  }
}
