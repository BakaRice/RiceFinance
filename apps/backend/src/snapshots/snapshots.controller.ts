import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SnapshotsService } from './snapshots.service';
import { CreateSnapshotRequest, SnapshotResponse } from './snapshots.dto';

@ApiTags('Snapshots')
@Controller('snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private snapshotsService: SnapshotsService) {}

  @Get()
  list(@CurrentUser() user: any): Promise<SnapshotResponse[]> {
    return this.snapshotsService.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() req: CreateSnapshotRequest): Promise<SnapshotResponse> {
    return this.snapshotsService.create(user.userId, req);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string): Promise<SnapshotResponse> {
    return this.snapshotsService.getById(user.userId, id);
  }
}
