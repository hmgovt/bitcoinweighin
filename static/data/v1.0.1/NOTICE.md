# Notice — v1.0.1 frozen

This directory holds the v1.0.1 release of the Bitcoin Weigh-In dataset,
updated daily until 2026-10-08 and frozen since. Its values are correct;
it is retained so analyses that cite it stay reproducible.

## Use v1.1.0 for new analysis

v1.1.0 (2026-10-09) carries the same columns, with the same values, in
the same positions, and appends four more after `forward_filled`:

- `gasoline_usd`, `diesel_usd`: US retail prices per US gallon, taxes
  included (EIA weekly surveys via FRED `GASREGW` / `GASDESW`),
  back-filled to 2013-01-02.
- `gasoline_per_btc`, `diesel_per_btc`: US gallons per BTC.

Download at <https://bitcoinweighin.com/data/v1.1.0/> or via the
"latest" aliases at <https://bitcoinweighin.com/data/>.

See the full release notes at
<https://bitcoinweighin.com/data#versions-and-changelog>.
