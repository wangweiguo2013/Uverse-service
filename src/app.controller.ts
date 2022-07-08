import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';
import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';

const UploadDir = path.resolve(__dirname, '../public/upload');

// 写入文件流
const pipeStream = (path, writeStream) =>
  new Promise((resolve) => {
    const readStream = fse.createReadStream(path);
    readStream.on('end', () => {
      fse.unlinkSync(path);
      resolve(0);
    });
    readStream.pipe(writeStream);
  });

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadFile(@UploadedFile() chunk: any, @Body() body) {
    const { filename, hash } = body;

    try {
      const chunkDir = path.resolve(UploadDir, `chunk${filename}`);
      if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir);
      }
      // const buffer = fs.readFileSync(chunk.bu);
      const ws = fs.createWriteStream(`${chunkDir}/${hash}`);
      ws.write(chunk.buffer);
      ws.close();
      return {
        success: true,
        msg: 'chunk saved',
      };
    } catch (error) {
      return {
        msg: error.toString(),
      };
    }
  }

  @Post('/merge')
  async mergeFile(@Body() body) {
    const { filename, size } = body;
    try {
      const chunkDir = path.resolve(UploadDir, `chunk${filename}`);
      const chunkPaths = await fse.readdir(chunkDir);
      chunkPaths.sort((a, b) => a - b);

      const filePath = path.resolve(UploadDir, `${filename}`);
      await Promise.all(
        chunkPaths.map((chunkPath, index) =>
          pipeStream(
            path.resolve(chunkDir, chunkPath), // 根据 size 在指定位置创建可写流
            fse.createWriteStream(filePath, {
              start: index * size,
            }),
          ),
        ),
      );
      // 合并后删除保存切片的目录
      fse.rmdirSync(chunkDir);

      return {
        success: true,
        data: chunkPaths,
        msg: 'chunk saved',
      };
    } catch (error) {
      return {
        msg: error.toString(),
      };
    }
  }
}
