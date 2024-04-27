import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpStatus,
} from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { IErrorException } from 'src/common/error/interfaces/error.interface';
import { HelperDateService } from 'src/common/helper/services/helper.date.service';
import { IMessageValidationError } from 'src/common/message/interfaces/message.interface';
import { MessageService } from 'src/common/message/services/message.service';
import { ENUM_REQUEST_STATUS_CODE_ERROR } from 'src/common/request/constants/request.status-code.constant';
import { RequestValidationException } from 'src/common/request/exceptions/request.validation.exception';
import { IRequestApp } from 'src/common/request/interfaces/request.interface';
import { ResponseMetadataDto } from 'src/common/response/dtos/response.dto';

@Catch(RequestValidationException)
export class ErrorValidationFilter implements ExceptionFilter {
    constructor(
        private readonly messageService: MessageService,
        private readonly configService: ConfigService,
        private readonly helperDateService: HelperDateService
    ) {}

    async catch(
        exception: RequestValidationException,
        host: ArgumentsHost
    ): Promise<void> {
        const ctx: HttpArgumentsHost = host.switchToHttp();
        const response: Response = ctx.getResponse<Response>();
        const request: IRequestApp = ctx.getRequest<IRequestApp>();

        // set default
        const rawErrors = exception.getErrors();
        const statusHttp: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY;
        const statusCode =
            ENUM_REQUEST_STATUS_CODE_ERROR.REQUEST_VALIDATION_ERROR;

        // metadata
        const xLanguage: string =
            request.__language ?? this.messageService.getLanguage();
        const xId = request.__id;
        const xTimestamp = this.helperDateService.createTimestamp();
        const xTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const xVersion = request.__version;
        const xRepoVersion = this.configService.get<string>('app.repoVersion');
        const metadata: ResponseMetadataDto = {
            language: xLanguage,
            timestamp: xTimestamp,
            timezone: xTimezone,
            requestId: xId,
            path: request.path,
            version: xVersion,
            repoVersion: xRepoVersion,
        };

        // set response
        const message = this.messageService.setMessage(exception.message, {
            customLanguage: xLanguage,
        });
        const errors: IMessageValidationError[] =
            this.messageService.setValidationMessage(rawErrors, {
                customLanguage: xLanguage,
            });

        const responseBody: IErrorException = {
            statusCode,
            message,
            errors,
            _metadata: metadata,
        };

        response
            .setHeader('x-custom-lang', xLanguage)
            .setHeader('x-timestamp', xTimestamp)
            .setHeader('x-timezone', xTimezone)
            .setHeader('x-request-id', xId)
            .setHeader('x-version', xVersion)
            .setHeader('x-repo-version', xRepoVersion)
            .status(statusHttp)
            .json(responseBody);

        return;
    }
}
