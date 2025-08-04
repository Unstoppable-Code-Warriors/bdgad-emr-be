import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'Welcome to the BDGAD EMR API',
      version: '1.0.0',
      documentation: 'https://docs.bdgad-emr.com',
    };
  }
}
