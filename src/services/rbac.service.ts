import db from '../config/database';
import { Role } from '../types';

class RbacService {
  private permissionsCache: Record<string, boolean> = {};
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  /**
   * Loads permissions from the database into the cache
   */
  private async loadPermissions() {
    const query = `SELECT role, action, resource FROM role_permissions`;
    try {
      const { rows } = await db.query(query);
      
      const newCache: Record<string, boolean> = {};
      for (const row of rows) {
        const key = `${row.role}:${row.action}:${row.resource}`;
        newCache[key] = true;
      }
      
      this.permissionsCache = newCache;
      this.lastCacheUpdate = Date.now();
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  }

  /**
   * Checks if a role has permission for a specific action on a resource
   */
  async hasPermission(role: Role, action: string, resource: string): Promise<boolean> {
    // Reload cache if expired
    if (Date.now() - this.lastCacheUpdate > this.CACHE_TTL) {
      await this.loadPermissions();
    }

    // Admin usually has all access, but let's stick to the DB permissions for strictness
    // as requested by "Permissões definidas por (role, action, resource)"
    const key = `${role}:${action}:${resource}`;
    return !!this.permissionsCache[key];
  }

  /**
   * Gets all permissions for a specific role (useful for frontend or debugging)
   */
  async getRolePermissions(role: Role) {
    const query = `SELECT action, resource FROM role_permissions WHERE role = $1`;
    const { rows } = await db.query(query, [role]);
    return rows;
  }
}

export default new RbacService();
