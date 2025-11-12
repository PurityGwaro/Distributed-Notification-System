import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TemplateService } from './template.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@ApiTags('templates')
@Controller('/api/v1/templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get template by code' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  findBycode(@Param('code') code: string) {
    return this.templateService.findByCode(code);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates' })
  @ApiResponse({
    status: 200,
    description: 'All Templates retrieved successfully',
  })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.templateService.findAll(page, limit);
  }
}
