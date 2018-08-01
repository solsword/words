// caching.js
// Offers dynamic caching to other modules.

define([], function() {
  // Objects to hold caches and their queues.
  var DOMAINS = {};
  var CACHES = {};
  var QUEUES = {};
  var CHECKING = {};

  // Whether to log warnings to the console or not.
  var WARNINGS = true;

  // Current global seed
  var SEED = 173;

  // How long to wait before re-attempting in case of undefined (milliseconds):
  var UNDEF_BACKOFF = 50;

  // How long to wait before (re-)checking cache (milliseconds):
  var CHECK_INITIAL_BACKOFF = 3;
  var CHECK_BACKOFF = 53;

  // How long since the most-recent request before we give up on creating a
  // value (maybe it's no longer needed?)
  var UNDEF_GIVEUP = 1000;

  // Default number of values to cache in each domain:
  var DEFAULT_CACHE_SIZE = 1024 * 1024;
  
  function set_seed(seed) {
    // Sets the global generation seed
    SEED = seed;
  }

  function register_domain(domain, key_fcn, computation, cache_size) {
    // Sets the generator and key functions for the given domain. The key
    // function should take generator arguments and return a string, while the
    // computation function should take the same arguments and return either a
    // value if generation is possible, or undefined if it isn't yet (in which
    // case generation will be attempted again after UNDEF_BACKOFF
    // milliseconds).
    //
    // The cache_size argument is optional, and DEFAULT_CACHE_SIZE will be
    // used if it is not supplied.
    if (cache_size == undefined) {
      cache_size = DEFAULT_CACHE_SIZE;
    }
    DOMAINS[domain] = [ key_fcn, computation, cache_size ];
  }

  function complete_computation(domain, args, accumulated) {
    // Helper for cached_value that keeps trying to generate a value at
    // intervals until the giveup timeout is reached. Places the value into the
    // cache as soon as it's ready. If the generator returns 'undefined', the
    // computation will be tried again.
    var dom = DOMAINS[domain];
    if (dom == undefined) {
      if (WARNINGS) {
        console.log(
          "Warning: unknown cache domain '" + domain + "'. Are you sure your "
        + "call to register_domain resolves before you call cached_value?"
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

  function cached_value(domain, args) {
    // Generates a value in the given domain with the given arguments, storing
    // and returning it. If a cached value already exists for the given
    // arguments in the given domain, just returns that instead. Caching new
    // values may kick out old cached values, and there's no way to replace a
    // value once it's established. Returns null the first time it's called and
    // subsequently until there's actually a value available, as the
    // computation is done asynchronously.
    //
    // The arguments should match those expected by the key and computation
    // functions passed to register_domain (see above).
    var dom = DOMAINS[domain];
    if (dom == undefined) {
      if (WARNINGS) {
        console.log(
          "Warning: unknown cache domain '" + domain + "'. Are you sure your "
        + "call to register_domain resolves before you call cached_value?"
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
      if (QUEUES.hasOwnProperty[key]) { // already queued
        return null;
      } else { // queue this computation
        QUEUES[domain][key] = true;
        setTimeout(
          complete_computation,
          0,
          domain,
          args,
          0
        );
        return null;
      }
    }
  }

  function with_cached_value(domain, args, continuation, c_arg) {
    // Waits until a cached value is available for the given key in the given
    // domain, and then executes the continuation, passing it the key, the
    // cached value, and the extra argument.
    var dom = DOMAINS[domain];
    if (dom == undefined) {
      if (WARNINGS) {
        console.log(
          "Warning: unknown cache domain '" + domain + "'. Are you sure your "
        + "call to register_domain resolves before you call cached_value?"
        );
      }
      return null;
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

  return {
    "WARNINGS": WARNINGS,
    "set_seed": set_seed,
    "register_domain": register_domain,
    "cached_value": cached_value,
    "with_cached_value": with_cached_value
  };
});
