export type DataMode = 'prototype' | 'api';

export interface DependencyStatus {
  name: 'postgresql' | 'redis' | string;
  address: string;
  reachable: boolean;
  latencyMs: number;
  error?: string;
}

export interface LiveHealth {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  time: string;
}

export interface ReadyHealth {
  status: 'ready' | 'degraded';
  dependencies: DependencyStatus[];
  time: string;
}

export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}
