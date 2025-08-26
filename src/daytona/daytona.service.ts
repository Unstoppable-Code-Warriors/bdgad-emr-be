import { Daytona, Image, Sandbox } from '@daytonaio/sdk';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DaytonaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DaytonaService.name);
  private daytona: Daytona;
  private sandbox: Sandbox;

  constructor(private readonly configService: ConfigService) {
    this.logger.log('DaytonaService initialized');
  }

  async onModuleInit() {
    this.daytona = new Daytona({
      apiKey: this.configService.get('DAYTONA_API_KEY'),
    });
    this.sandbox = await this.daytona.create({
      language: 'python',
      image: Image.debianSlim('3.13'),
      autoStopInterval: 0,
      resources: {
        cpu: 2, // 2 CPU cores
        memory: 4, // 4GB RAM
        disk: 4, // 4GB disk space
      },
    });

    // Proactively install required Python libraries for Excel analysis/web requests
    this.logger.log('Installing Python dependencies in Daytona sandbox...');
    await this.sandbox.process.executeCommand(
      'pip install --no-input --disable-pip-version-check pandas numpy openpyxl xlrd requests',
    );
    this.logger.log('Python dependencies installed.');
  }

  async onModuleDestroy() {
    if (this.sandbox) await this.sandbox.delete();
  }

  public async executePythonCode(pythonCode: string) {
    const result = await this.sandbox.process.codeRun(pythonCode);
    return result;
  }
}
