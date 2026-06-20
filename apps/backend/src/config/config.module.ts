import { Global, Module } from '@nestjs/common';
import { envConfig } from './env.config';

@Global()
@Module({
  providers: [
    {
      provide: 'ENV_CONFIG',
      useFactory: envConfig,
    },
  ],
  exports: ['ENV_CONFIG'],
})
export class ConfigModule {}
