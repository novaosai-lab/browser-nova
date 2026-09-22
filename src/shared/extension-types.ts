export interface SideExtension {
  id: string;
  name: string;
  version: string;
  hosts: string[];
  enabled: boolean;
  error?: string;
}
