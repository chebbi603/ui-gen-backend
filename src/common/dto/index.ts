export type UserDTO = {
  id: string;
  name: string;
  lastActive: string; // ISO string
  contractVersion: string;
};

export type ContractDTO = {
  userId: string;
  version: string;
  json: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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
