import { Request } from "express";

export function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<any> {
  if (securityName === "cookieAuth") {
    const userId = (request.session as any)?.userId;
    if (userId) {
      return Promise.resolve({ userId });
    }
  }
  return Promise.reject(new Error("Not authenticated"));
}
