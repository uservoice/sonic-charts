  if (typeof define === "function" && define.amd) { define(Shart); }
  else if (typeof module === "object" && module.exports) { module.exports = Shart; }
  else if (window) { window.Shart = Shart; }
}(undefined);
