export type UserDTO = {
  id: string;
  username?: string;
  email?: string;
  name: string;
  lastActive: string; // ISO string
  contractVersion: string;
};

export type ContractDTO = {
  id: string;
  userId: string;
  version: string;
  json: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
};

export type TrackingEventDTO = {
  id: string;
  userId: string;
  eventType: string;
  timestamp: string;
  page?: string;
  component?: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
};
