// caching.js
// Offers dynamic caching to other modules.
/* jshint esversion: 6 */

// Objects to hold caches and their queues.
var DOMAINS = {};
var CACHES = {};
var QUEUES = {};
var CHECKING = {};

/**
 * Whether to log warnings to the console or not.
 */
export var WARNINGS = true;

/**
 * Current global seed
 * */
var SEED = 173;

/**
 * How long to wait before re-attempting in case of undefined (milliseconds):
 */
export var UNDEF_BACKOFF = 50;

/**
 * How long to wait before (re-)checking cache (milliseconds):
 */
export var CHECK_INITIAL_BACKOFF = 3;
export var CHECK_BACKOFF = 53;

/**
 * How long since the most-recent request before we give up on creating a
 * value (maybe it's no longer needed?)
 */
export var UNDEF_GIVEUP = 1000;

/**
 * Default number of values to cache in each domain:
 */
export var DEFAULT_CACHE_SIZE = 1024 * 1024;

/**
 * Sets the global generation seed
 *
 * @param seed The new seed to use.
 */
export function set_seed(seed) {
    SEED = seed;
}

/**
 * Sets the generator and key functions for the given domain. The key
 * function should take generator arguments and return a string, while
 * the computation function should take the same arguments and return
 * either a value if generation is possible, or undefined if it isn't yet
 * (in which case generation will be attempted again after UNDEF_BACKOFF
 * milliseconds).
 *
 * @param domain The cache domain ID (a string) to register.
 * @param key_fcn A function which takes the same arguments as the
 *     computaiton function and returns a string key for that result.
 * @param computation The function which will be run to generate results
 *     for the given domain. It may take any number of arguments, but its
 *     signature must match that of the key function.
 * @param cache_size (optional) The size of the cache for this domain (in
 *     cache entries). If not given, DEFAULT_CACHE_SIZE will be used.
 */
export function register_domain(domain, key_fcn, computation, cache_size) {
    if (cache_size == undefined) {
        cache_size = DEFAULT_CACHE_SIZE;
    }
    DOMAINS[domain] = [ key_fcn, computation, cache_size ];
}

/**
 * Helper for cached_value that keeps trying to generate a value at
 * intervals until the giveup timeout is reached. Places the value into
 * the cache as soon as it's ready. If the generator returns 'undefined',
 * the computation will be tried again.
 *
 * @param domain The cache domain ID (a string).
 * @param args The arguments to give to the computation function for the
 *     given domain.
 * @param accumulated The amount of time that's been spent trying to
 *     complete this computation already. Leave undefined to start
 *     counting from zero.
 */
export function complete_computation(domain, args, accumulated) {
    if (accumulated == undefined) {
        accumulated = 0;
    }
    var dom = DOMAINS[domain];
    if (dom == undefined) {
        if (WARNINGS) {
            console.log(
                "Warning: unknown cache domain '" + domain + "'. Are you "
              + "sure your call to register_domain resolves before you "
              + "call cached_value?"
            );
        }
        return;
    }
    var key = dom[0].apply(null, args);
    if (accumulated > UNDEF_GIVEUP) {
        delete QUEUES[domain][key]; // allow re-queue
        return;
    }
    var result = dom[1].apply(null, args);
    var cache = CACHES[domain];
    if (result == undefined) {
        setTimeout(
            complete_computation,
            UNDEF_BACKOFF,
            domain,
            args,
            accumulated + UNDEF_BACKOFF
        );
        return;
    } else {
        cache[key] = [result, 0];
        // increment cache ages:
        var oldest = [null, 0];
        var cache_size = 0;
        for (var ok in cache) {
            if (cache.hasOwnProperty(ok)) {
                cache_size += 1;
                cache[ok][1] += 1;
                if (cache[ok][1] > oldest[1]) {
                    oldest = [ ok, cache[ok][1] ];
                }
            }
        }
        // kick out oldest value if necessary
        if (cache_size > dom[2]) {
            delete cache[oldest];
        }
    }
}

/**
 * Generates a value in the given domain with the given arguments,
 * storing and returning it. If a cached value already exists for the
 * given arguments in the given domain, just returns that instead.
 * Caching new values may kick out old cached values, and there's no
 * way to replace a value once it's established. Returns null the
 * first time it's called and subsequently until there's actually a
 * value available, as the computation is done asynchronously.
 *
 * The arguments should match those expected by the key and
 * computation functions passed to register_domain (see above).
 *
 * @param domain The domain ID (a string) to generate a value from.
 * @param args The arguments to that domain's computation function.
 *
 * @return The value from the given domain for the given arguments
 *     (possibly a stored value from the cache), or null if that value
 *     doesn't exist yet (in that case the generation of that value is
 *     initiated and it will eventually be created).
 */
export function cached_value(domain, args) {
    var dom = DOMAINS[domain];
    if (dom == undefined) {
        if (WARNINGS) {
            console.log(
                "Warning: unknown cache domain '" + domain + "'. Are you "
              + "sure your call to register_domain resolves before you call "
              + "cached_value?"
            );
        }
        return null;
    }
    var key = dom[0].apply(null, args); // TODO: Give args one-by-one
    var cache = CACHES[domain];
    if (cache == undefined) {
        cache = {};
        CACHES[domain] = cache;
        QUEUES[domain] = {};
    }
    var queue = QUEUES[domain];
    if (cache.hasOwnProperty(key)) { // already in cache
        var cell = cache[key];
        cell[1] = 0; // reset age
        return cell[0];
    } else { // not yet cached
        if (queue.hasOwnProperty(key)) { // already queued
            return null;
        } else { // queue this computation
            queue[key] = true;
            setTimeout(
                complete_computation,
                0,
                domain,
                args
            );
            return null;
        }
    }
}

/**
 * Waits until a cached value is available for the given key in the
 * given domain, and then executes the continuation, passing it the
 * key, the cached value, and the extra argument.
 *
 * @param domain The domain ID (a string) to retrieve a value from.
 * @param args The arguments to the computation function for the given
 *     domain.
 * @param continuation The function to call either immediately or
 *     whenever the domain value becomes available. It will be given the
 *     cache key that corresponds to the given arguments, the cached
 *     value, and the extra c_arg argument.
 * @param c_arg An extra argument to pass to the continuation function.
 */
export function with_cached_value(domain, args, continuation, c_arg) {
    var dom = DOMAINS[domain];
    if (dom == undefined) {
        if (WARNINGS) {
            console.log(
                "Warning: unknown cache domain '" + domain + "'. Are you "
              + "sure your call to register_domain resolves before you "
              + "call cached_value?"
            );
        }
        return;
    }
    var key = dom[0].apply(null, args);
    var value = cached_value(domain, args);
    if (value == null) {
        if (!CHECKING.hasOwnProperty(domain)) {
            CHECKING[domain] = {};
        }
        if (CHECKING[domain].hasOwnProperty(key)) {
            setTimeout(
                with_cached_value,
                CHECK_BACKOFF,
                domain,
                args,
                continuation,
                c_arg
            );
        } else {
            CHECKING[domain][key] = true;
            setTimeout(
                with_cached_value,
                CHECK_INITIAL_BACKOFF,
                domain,
                args,
                continuation,
                c_arg
            );
        }
    } else {
        delete CHECKING[domain][key];
        continuation(key, value, c_arg);
    }
}
