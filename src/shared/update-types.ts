export type UpdateStatus =
  | 'disabled' | 'idle' | 'checking' | 'available' | 'not-available'
  | 'downloading' | 'downloaded' | 'installing' | 'error';

export interface UpdateState {
  currentVersion: string;
  status: UpdateStatus;
  message: string;
  availableVersion?: string;
  percent?: number;
  lastCheckedAt?: string;
}
