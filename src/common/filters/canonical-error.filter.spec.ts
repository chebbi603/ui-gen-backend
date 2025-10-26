import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { CanonicalErrorFilter } from './canonical-error.filter';

function createHost(headers: Record<string, string> = {}) {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const req: any = { headers };
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as ArgumentsHost;
  return { host, res };
}

describe('CanonicalErrorFilter', () => {
  let filter: CanonicalErrorFilter;

  beforeEach(() => {
    filter = new CanonicalErrorFilter();
  });

  it('formats HttpException with object response and includes requestId', () => {
    const { host, res } = createHost({ 'x-request-id': 'req-123' });
    const exception = new HttpException({ message: 'Bad', code: 'BAD', details: { reason: 'x' } }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD',
        message: 'Bad',
        details: { reason: 'x' },
      },
      requestId: 'req-123',
    });
  });

  it('formats HttpException with string response and default code', () => {
    const { host, res } = createHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.error.message).toBe('Not Found');
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('formats generic Error with 500 and stack details', () => {
    const { host, res } = createHost();
    const exception = new Error('boom');

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.error.message).toBe('boom');
    expect(payload.error.details).toHaveProperty('stack');
  });
});