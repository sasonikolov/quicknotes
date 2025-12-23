<?php
/**
 * Quick Notes Configuration
 *
 * This file contains settings for password validation and user management.
 * Keep this file secure and do not expose it publicly.
 */

return [
    /**
     * Require global access code in addition to personal password
     * When true: Users need BOTH the global code AND their personal password
     * When false: Only personal password is required
     */
    'require_global_code' => true,

    /**
     * Global access code pattern
     * Available placeholders:
     *   {YYYY} - Current year (4 digits)
     *   {YY}   - Current year (2 digits)
     *   {MM}   - Current month (2 digits)
     *   {DD}   - Current day (2 digits)
     *
     * Example: '#jimmy{DD}Bondi_{YYYY}{MM}' becomes '#jimmy22Bondi_202512' in 22th. December 2025
     */
    'global_code_pattern' => '{YYYY}{MM}',

    /**
     * Minimum password length for personal passwords
     */
    'min_password_length' => 6,

    /**
     * Password complexity rules (all default off)
     */
    'password_require_uppercase' => false,  // Require at least one uppercase letter (A-Z)
    'password_require_lowercase' => false,  // Require at least one lowercase letter (a-z)
    'password_require_number' => false,     // Require at least one number (0-9)

    /**
     * Allowed usernames (leave empty to allow any username)
     * Example: ['admin', 'saso', 'guest']
     */
    'allowed_usernames' => [],

    /**
     * Blocked usernames (these usernames cannot be used)
     * Example: ['admin', 'root', 'test']
     */
    'blocked_usernames' => ['admin', 'root', 'administrator', 'test'],
];
