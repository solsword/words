// env.js
// Functions for managing "environment variables" from the URL

"use strict";

/**
 * Extracts an "environment" object from the current URL. The hash part
 * of the URL is URI-decoded and parsed into comma-separated name =
 * value pairs; each name becomes a key and each string value becomes
 * that key's value. So if the URL had:
 *
 * #a=3,b=four
 *
 * You'd get an object:
 *
 * {
 *   'a': '3',
 *   'b': 'four'
 * }
 *
 * (Note that 3 here is a string, not a number.)
 *
 * @return An environment object with string keys and values.
 */
export function get_environment() {
    let hash = window.location.hash;
    let env_vars = {};
    if (hash.length > 0) {
        let encodeditems = hash.slice(1);
        let decodeditems = decodeURIComponent(encodeditems);
        let hashitems = decodeditems.split(',');
        for (let hi of hashitems) {
            let parts = hi.split('=');
            if (parts.length == 2) {
                env_vars[parts[0]] = parts[1];
            }
        }
    }

    return env_vars;
}

/**
 * Updates the hash aspect of the current URL to use the given key/value
 * mapping. Each value in the given environment object must be a string.
 *
 * Note that after calling this function, you may want to call
 * window.location.reload() to apply the new environment.
 *
 * @param env An object with string keys and values. The keys and values
 *     may not contain '=' or ',' characters.
 */
export function set_environment(env) {
    let result = ""
    for (let key of Object.keys(env)) {
        if (key.includes('=') || key.includes(',')) {
            throw ("Invalid environment key: '" + key + "' (contains = or ,)");
        }
        let val = env[key];
        if (val.includes('=') || val.includes(',')) {
            throw ("Invalid environment val: '" + val + "' (contains = or ,)");
        }

        result += key + "=" + val + ","
    }

    // chop off extra comma at the end
    if (result.length > 0) {
        result = result.slice(0, result.length - 1);
    }

    window.location.hash = '#' + encodeURIComponent(result);
}

/**
 * Works like set_environment, but retains the values of any existing
 * environment variables that aren't keys in the given update object.
 *
 * Note that after calling this function, you may want to call
 * window.location.reload() to apply the new environment.
 *
 * @param update An object with string keys and values. The keys and
 *     values may not contain '=' or ',' characters.
 */
export function update_environment(update) {
    let updated = get_environment();
    for (let key of Object.keys(update)) {
        updated[key] = update[key];
    }
    set_environment(updated);
}
