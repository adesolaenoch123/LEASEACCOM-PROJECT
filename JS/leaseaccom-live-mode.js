/**
 * LeaseAccom production mode — no demo / localStorage as source of truth on live hosts.
 */
(function (global) {
  "use strict";
  function hostname() {
    try { return String(global.location && global.location.hostname || ""); } catch (e) { return ""; }
  }
  function isLocalHost() {
    var h = hostname();
    return h === "localhost" || h === "127.0.0.1" || h === "" || h === "0.0.0.0";
  }
  function isProduction() {
    return !isLocalHost();
  }
  /** Local demo fallback only on localhost */
  function allowLocalFallback() {
    return isLocalHost();
  }
  function hasCloud() {
    return !!(global.LeaseAccomCloud && typeof global.LeaseAccomCloud.hasSb === "function" && global.LeaseAccomCloud.hasSb())
      || !!(global.leaseaccomSupabase || global.leasehubSupabase);
  }
  global.LeaseAccomLiveMode = {
    isLocalHost: isLocalHost,
    isProduction: isProduction,
    allowLocalFallback: allowLocalFallback,
    hasCloud: hasCloud
  };
})(window);
