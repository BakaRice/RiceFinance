import { ApiProperty } from '@nestjs/swagger';

export class AIReviewResponse {
  @ApiProperty() clientUid: string;
  @ApiProperty() summary: string;
  @ApiProperty() highlights: string[];
  @ApiProperty() risks: string[];
  @ApiProperty() nextActions: string[];
  @ApiProperty() disclaimer: string;
  @ApiProperty() model: string;
  @ApiProperty() generatedAt: string;
}
