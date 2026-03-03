import { User } from '@prisma/client';

/**
 * Security Helper
 * Provides utility methods for role-based access control and identity validation.
 */
export class SecurityService {
    /**
     * Checks if a user has admin privileges.
     */
    static isAdmin(user?: { role: string }): boolean {
        return user?.role === 'ADMIN';
    }

    /**
     * Checks if a user is the owner of a resource.
     */
    static isOwner(userId: string, resourceCreatorId: string): boolean {
        return userId === resourceCreatorId;
    }

    /**
     * Validates that the current user has permission to manage an event.
     */
    static canManageEvent(userId: string, event: { creatorId: string }): boolean {
        return this.isOwner(userId, event.creatorId);
    }
}
