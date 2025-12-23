<?php
/**
 * Quick Notes Configuration
 *
 * This file contains settings for password validation and user management.
 * Keep this file secure and do not expose it publicly.
 */

return [
    /**
     * Password mode: 'individual' or 'global'
     *
     * 'individual' - Each user has their own password (stored hashed in their JSON file)
     *                First login creates the account with the provided password
     *
     * 'global'     - All users share the same password pattern (legacy mode)
     */
    'password_mode' => 'individual',

    /**
     * Global password pattern (only used when password_mode = 'global')
     * Available placeholders:
     *   {YYYY} - Current year (4 digits)
     *   {YY}   - Current year (2 digits)
     *   {MM}   - Current month (2 digits)
     *   {DD}   - Current day (2 digits)
     *
     * Example: '#secret_{YYYY}{MM}' becomes '#secret_202512' in December 2025
     */
    'global_password_pattern' => '#snipic_{YYYY}{MM}',

    /**
     * Minimum password length for individual passwords
     */
    'min_password_length' => 6,

    /**
     * Allowed usernames (leave empty to allow any username)
     * Example: ['admin', 'saso', 'guest']
     */
    'allowed_usernames' => [],
];
