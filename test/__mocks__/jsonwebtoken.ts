export const sign = (..._args: any[]) => 'mock-token';
export const verify = (..._args: any[]) => ({ userId: 'mock-user' });
export const decode = (..._args: any[]) => ({ header: {}, payload: {} });