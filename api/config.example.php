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
     * Example: '#snipic_{YYYY}{MM}' becomes '#snipic_202512' in December 2025
     */
    'global_code_pattern' => '#snipic_{YYYY}{MM}',

    /**
     * Minimum password length for personal passwords
     */
    'min_password_length' => 6,

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
