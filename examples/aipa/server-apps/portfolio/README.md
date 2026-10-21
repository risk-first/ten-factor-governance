# Portfolio

Server-app that owns the demo holdings book. Broadcasts `fdc3.portfolio` /
`position` / `instrument`, responds to `GetPortfolio` (returns `fdc3.portfolio`)
and `ViewHoldings`.

The live book is `temp/portfolio.json` (gitignored). It is created from
`common/fixtures/portfolio.json` on first read; Execution updates the same file
when `demo.SubmitOrder` fills.
