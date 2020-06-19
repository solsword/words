// locale.js
// Locale-specific fixes & stuff.
/* jshint esversion: 6 */

// Note: so that this can be accessed from both normal module code and
// web workers, we are currently forced to implement it as a classic JS
// script, not a module. When cross-browser support for loading modules
// from web workers is available, this should be re-implemented as a
// module. At that point, the extra script tag which loads it will no
// longer be necessary.

/**
 * A default string that can be used wherever a locale is needed.
 */
const DEFAULT_LOCALE = "en-US";

/**
 * Returns the all-uppercase version of a string in the given locale.
 *
 * @param string The string to uppercase.
 * @param locale A locale string like "en-US".
 *
 * @return A new string where each character has been converted to its
 *     uppercase equivalent according to the given locale, if it wasn't
 *     already uppercase.
 */
function lc_upper(string, locale) {
    return string.toLocaleUpperCase(locale);
}

/**
 * Returns the all-lowercase version of a string in the given locale.
 *
 * @param string The string to lowercase.
 * @param locale A locale string like "en-US".
 *
 * @return A new string where each character has been converted to its
 *     lowercase equivalent according to the given locale, if it wasn't
 *     already lowercase.
 */
function lc_lower(string, locale) {
    return string.toLocaleLowerCase(locale);
}


// TODO: This hack lets us use syntax as if we had imported this as a
// module, but it should be removed once we really can have this be a
// module again.
locale = {
    'DEFAULT_LOCALE': DEFAULT_LOCALE,
    'lc_upper': lc_upper,
    'lc_lower': lc_lower,
};
