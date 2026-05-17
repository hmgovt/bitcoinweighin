# Notice — v1.0 superseded

This directory holds the v1.0 release of the Bitcoin Weigh-In dataset
as it was published on 2026-05-17. It is retained for archival
continuity but **should not be used for new analysis**.

## Known issue in v1.0

`coffee_usd` was carried through from the raw Stooq feed in US cents
per pound rather than US dollars per pound. As a result,
`coffee_per_btc` in v1.0 is 100× the correct figure. The unit label
on the v1.0 schema warns about this, but anyone running aggregate
analysis without reading the schema note will produce coffee-related
results that are silently wrong.

## Use v1.0.1 instead

A corrected release, **v1.0.1**, was published on 2026-05-17:

- `coffee_usd` is now expressed in USD per pound.
- `coffee_per_btc` is now correctly denominated in pounds per BTC.
- The 2013-01-01 row (no commodity closes; nothing to forward-fill
  from) was dropped. Coverage now starts at 2013-01-02.

Download at <https://bitcoinweighin.com/data/v1.0.1/> or via the
"latest" aliases at <https://bitcoinweighin.com/data/>.

See the full release notes at
<https://bitcoinweighin.com/data#versions-and-changelog>.
