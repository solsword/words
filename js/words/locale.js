// locale.js
// Locale-specific fixes & stuff.

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
export function upper(string, locale) {
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
export function lower(string, locale) {
    return string.toLocaleLowerCase(locale);
}
