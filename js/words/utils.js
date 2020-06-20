// utils.js
// Miscellaneous general utilities.

"use strict";

/**
 * Generates an array containing the N numbers 0 .. N-1.
 *
 * @param n The number of sequential integers to put into the result.
 *
 * @return An array of n sequential integers starting at 0.
 */
export function range(n) {
    let result = [];
    for (let i = 0; i < n; ++i) {
        result.push(i);
    }
    return result;
}

/**
 * Generic object comparator that recursively handles nested objects,
 * including recursive objects. Very roughly two objects will be
 * considered equivalent if they would result in equal JSON strings.
 *
 * @param a The first object to compare.
 * @param b The second object to compare.
 * @param seen (omit) Leave out this parameter so that it can be assigned
 *     automatically. In recursive calls it will be set up as a 4-element
 *     array containing the current field/index chain string, a set of
 *     objects seen before, and two mappings from field/index chain
 *     strings to objects at those positions.
 */
export function equivalent(a, b, seen) {
    if (seen == undefined) {
        seen = [ "", new Set(), {}, {} ];
    }

    // Unpack the 'seen' data structure.
    let access_path = seen[0];
    let encountered = seen[1];
    let a_paths = seen[2];
    let b_paths = seen[3];

    // If both objects have been seen before during this comparison, then
    // we cannot recursively compare them, because we're already in that
    // process. For the original recursive objects to really be
    // equivalent in structure, their recursive pieces must be placed in
    // equivalent positions relative to the whole object structure. Seen
    // from the perspective of the recursive object part, if the chain of
    // field accesses and index accesses that leads to the recursive copy
    // of the top-level object is equivalent between the two objects,
    // then the recursive entry is fine, and we return true.
    //
    // Note: if only one object has been seen before, we can safely
    // recurse and therefore use the normal comparison method.
    if (seen[1].has(a) && seen[1].has(b)) {

        // reverse lookup of all previous paths where object a was found
        let prev_a = new Set();
        for (let k of Object.keys(a_paths)) {
            if (a_paths[k] === a) {
                prev_a.add(k);
            }
        }
        // same for object b
        let prev_b = new Set();
        for (let k of Object.keys(b_paths)) {
            if (b_paths[k] === b) {
                prev_b.add(k);
            }
        }

        // If the # of previous references isn't balanced, something's
        // uneven and we can't have equality.
        if (prev_a.size != prev_b.size) {
            return false;
        }

        // If all of the access paths are paired, then we count this
        // recursive appearance as equal, and let the rest of the process
        // move on to see if they're really equal or not.
        if ((prev_a && prev_b).size == prev_a.size) {
            return true;
        }

        // Otherwise, the two objects have some kind of discrepancy.
        return false;
    }

    if (typeof(a) != typeof(b)) {
        return false;
    } else if (typeof(a) == "object" && !(a instanceof String)) {
        // Object compare
        if (a instanceof String) {
            // Strings (ugh)
            return a.toString() == b.toString();
        } else if (Array.isArray(a)) {
            // Arrays

            // Update our 'seen' data structure
            a_paths[access_path] = a;
            b_paths[access_path] = b;
            encountered.add(a);
            encountered.add(b);

            if (!Array.isArray(b)) {
                return false;
            }
            if (a.length != b.length) {
                return false;
            }
            for (var i in a) {
                if (
                    !equivalent(
                        a[i],
                        b[i],
                        [access_path + '.' + i, encountered, a_paths, b_paths]
                    )
                ) {
                    return false;
                }
            }
            return true;
        } else {
            // Generic objects

            // Update our 'seen' data structure
            a_paths[access_path] = a;
            b_paths[access_path] = b;
            encountered.add(a);
            encountered.add(b);

            for (let key of Object.keys(a)) {
                if (!b.hasOwnProperty(key)) {
                    return false;
                } else if (
                    !equivalent(
                        a[key],
                        b[key],
                        [
                            access_path + '.' + key,
                            encountered,
                            a_paths,
                            b_paths
                        ]
                    )
                ) {
                    return false;
                }
            }
            for (let key of Object.keys(b)) {
                if (!a.hasOwnProperty(key)) {
                    return false;
                }
                // equality already checked in loop above
            }
            return true;
        }
    } else {
        // Primitive type compare, including strings
        return a == b;
    }
}

/**
 * Converts a string to an array of single-character strings (use
 * .join("") to reverse).
 *
 * @param str The string to convert.
 *
 * @return A new array containing all of the characters from the string
 *     as individual 1-character strings.
 */
export function string__array(str) {
    let result = [];
    for (let g of str) {
        result.push(g);
    }
    return result;
}
