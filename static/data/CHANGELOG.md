# Changelog

All notable changes to the Bitcoin Weigh-In dataset are documented here.
This dataset follows semantic versioning for breaking column changes
(major: removed or renamed columns; minor: added columns or sources;
patch: bug fixes that do not change schema).

## v1.0 - 2026-05-17

Initial public release.

- Raw daily USD closes for BTC, gold (XAU), silver (XAG), platinum (XPT),
  copper (HG continuous), wheat (ZW continuous), coffee (KC continuous),
  and Brent crude (FRED DCOILBRENTEU).
- Derived per-BTC columns: xau_per_btc, xag_per_btc, xpt_per_btc,
  copper_per_btc, brent_per_btc, wheat_per_btc, coffee_per_btc.
- Deterministic BTC circulating supply computed from the halving schedule
  (no API dependency).
- Coverage: 2013-01-01 to present, daily.
- Forward-fill: per-row provenance is not reconstructable from existing
  data; the `forward_filled` column is present but populated as empty
  string for all v1.0 rows. Prospective tracking will begin in v1.1.
