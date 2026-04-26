import { prisma } from '../db';

// Custom privacy rule types
interface CustomPrivacyRule {
  field: string;
  visibility: 'public' | 'friends' | 'private';
  exceptions?: string[]; // User IDs that can always see this field
}

interface CustomPrivacyConfig {
  rules: CustomPrivacyRule[];
  defaultVisibility: 'public' | 'friends' | 'private';
}

/**
 * CustomPrivacyService - Handles custom privacy rules evaluation
 */
export class CustomPrivacyService {
  /**
   * Evaluate custom privacy rules for a specific viewer
   */
  static async evaluateCustomRules(
    targetUserId: string,
    viewerId: string | null,
    customRules: any
  ): Promise<{ allowed: boolean; filteredFields?: string[] }> {
    if (!customRules || typeof customRules !== 'object') {
      return { allowed: true };
    }

    const config: CustomPrivacyConfig = customRules;
    const filteredFields: string[] = [];

    // Check each custom rule
    for (const rule of config.rules || []) {
      const canViewField = await this.canViewField(
        targetUserId,
        viewerId,
        rule
      );

      if (!canViewField) {
        filteredFields.push(rule.field);
      }
    }

    // If all fields are filtered, deny access entirely
    const profileFields = ['bio', 'dateOfBirth', 'profilePictureUrl', 'website', 'occupation', 'companyName', 'location'];
    const allFieldsFiltered = profileFields.every(field => filteredFields.includes(field));

    if (allFieldsFiltered) {
      return { allowed: false };
    }

    return { allowed: true, filteredFields };
  }

  /**
   * Check if a viewer can see a specific field based on custom rules
   */
  private static async canViewField(
    targetUserId: string,
    viewerId: string | null,
    rule: CustomPrivacyRule
  ): Promise<boolean> {
    // Owner can always see their own fields
    if (viewerId && viewerId === targetUserId) {
      return true;
    }

    // Check exceptions first
    if (rule.exceptions && viewerId && rule.exceptions.includes(viewerId)) {
      return true;
    }

    // Check based on visibility level
    switch (rule.visibility) {
      case 'public':
        return true;

      case 'friends':
        if (!viewerId) return false;
        // Import FriendshipService here to avoid circular dependency
        const { FriendshipService } = await import('./FriendshipService');
        return await FriendshipService.areFriends(targetUserId, viewerId);

      case 'private':
        return false;

      default:
        return true;
    }
  }

  /**
   * Filter profile data based on custom privacy rules
   */
  static async filterProfileData(
    profileData: any,
    targetUserId: string,
    viewerId: string | null,
    customRules: any
  ): Promise<any> {
    const evaluation = await this.evaluateCustomRules(
      targetUserId,
      viewerId,
      customRules
    );

    if (!evaluation.allowed) {
      return null;
    }

    if (!evaluation.filteredFields || evaluation.filteredFields.length === 0) {
      return profileData;
    }

    // Create filtered profile by removing restricted fields
    const filteredProfile = { ...profileData };
    for (const field of evaluation.filteredFields) {
      delete filteredProfile[field];
    }

    return filteredProfile;
  }

  /**
   * Validate custom privacy rules structure
   */
  static validateCustomRules(rules: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!rules || typeof rules !== 'object') {
      return { valid: false, errors: ['Custom rules must be an object'] };
    }

    const config = rules as CustomPrivacyConfig;

    // Validate rules array
    if (config.rules && !Array.isArray(config.rules)) {
      errors.push('Rules must be an array');
    }

    if (config.rules) {
      for (const rule of config.rules) {
        const ruleErrors = this.validateRule(rule);
        errors.push(...ruleErrors);
      }
    }

    // Validate default visibility
    if (config.defaultVisibility) {
      const validVisibilities = ['public', 'friends', 'private'];
      if (!validVisibilities.includes(config.defaultVisibility)) {
        errors.push(`Invalid default visibility: ${config.defaultVisibility}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate individual custom privacy rule
   */
  private static validateRule(rule: any): string[] {
    const errors: string[] = [];

    if (!rule || typeof rule !== 'object') {
      errors.push('Each rule must be an object');
      return errors;
    }

    if (!rule.field || typeof rule.field !== 'string') {
      errors.push('Rule must have a field name');
    }

    if (!rule.visibility) {
      errors.push('Rule must have a visibility level');
    } else {
      const validVisibilities = ['public', 'friends', 'private'];
      if (!validVisibilities.includes(rule.visibility)) {
        errors.push(`Invalid visibility: ${rule.visibility}`);
      }
    }

    if (rule.exceptions && !Array.isArray(rule.exceptions)) {
      errors.push('Exceptions must be an array');
    }

    return errors;
  }

  /**
   * Get default custom privacy rules template
   */
  static getDefaultRules(): CustomPrivacyConfig {
    return {
      rules: [
        {
          field: 'bio',
          visibility: 'public',
        },
        {
          field: 'profilePictureUrl',
          visibility: 'public',
        },
        {
          field: 'website',
          visibility: 'public',
        },
        {
          field: 'occupation',
          visibility: 'public',
        },
        {
          field: 'companyName',
          visibility: 'friends',
        },
        {
          field: 'location',
          visibility: 'friends',
        },
        {
          field: 'dateOfBirth',
          visibility: 'private',
        },
      ],
      defaultVisibility: 'public',
    };
  }
}
