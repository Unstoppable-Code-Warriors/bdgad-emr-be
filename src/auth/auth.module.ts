import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    HttpModule,
    CacheModule.register({
      ttl: 300000, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache
    }),
  ],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
