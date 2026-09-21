import { session, Session } from 'electron';

export class SessionManager {
  private static defaultSession: Session | null = null;
  private static isolatedSessions: Map<string, Session> = new Map();

  public static getDefaultSession(): Session {
    if (!this.defaultSession) {
      this.defaultSession = session.fromPartition('persist:nova-default', {
        cache: true,
      });

      // Configure security headers and permissions
      this.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        // Safe defaults: deny location, notification, media unless explicitly requested
        const allowedPermissions = ['clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
        if (allowedPermissions.includes(permission)) {
          callback(true);
        } else {
          callback(false);
        }
      });
    }
    return this.defaultSession;
  }

  public static getIsolatedSession(id = 'test-profile'): Session {
    let sess = this.isolatedSessions.get(id);
    if (!sess) {
      // In-memory isolated partition without persistent cache/cookies
      sess = session.fromPartition(`nova-isolated-${id}`, {
        cache: false,
      });
      this.isolatedSessions.set(id, sess);
    }
    return sess;
  }

  public static clearIsolatedSession(id = 'test-profile'): void {
    const sess = this.isolatedSessions.get(id);
    if (sess) {
      sess.clearStorageData();
      this.isolatedSessions.delete(id);
    }
  }
}
