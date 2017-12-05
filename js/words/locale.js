// locale.js
// Locale-specific fixes & stuff.
//
define([], function() {
  DEFAULT_LOCALE = "en-US";

  function upper(string, locale) {
    return string.toLocaleUpperCase(locale);
  }

  function lower(string, locale) {
    return string.toLocaleLowerCase(locale);
  }

  return {
    "DEFAULT_LOCALE": DEFAULT_LOCALE,
    "upper": upper,
    "lower": lower,
  };
});
