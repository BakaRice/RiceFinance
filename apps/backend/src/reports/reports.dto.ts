import { ApiProperty } from '@nestjs/swagger';

export class ReportResponse {
  @ApiProperty() id: string;
  @ApiProperty() clientUid: string;
  @ApiProperty() title: string;
  @ApiProperty() reportType: string;
  @ApiProperty() markdown: string;
  @ApiProperty() summaryJson?: any;
  @ApiProperty() generatedAt: string;
}
