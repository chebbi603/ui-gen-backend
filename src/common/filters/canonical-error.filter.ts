import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class CanonicalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let details: any = undefined;
    let code = 'UNKNOWN_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = (HttpStatus as any)[status] || code;
      const res: any = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        message = res.message || message;
        details = res.details || res.error || res;
        code = res.code || (HttpStatus as any)[status] || code;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      details = { stack: exception.stack };
    }

    const payload = {
      error: {
        code,
        message,
        details,
      },
      requestId: request.headers['x-request-id'] || undefined,
    };

    response.status(status).json(payload);
  }
}