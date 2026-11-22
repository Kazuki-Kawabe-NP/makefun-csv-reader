# Exact CSV reader with batched JSON output

[![Competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kazuki-Kawabe-NP/makefun-csv-reader/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Kazuki-Kawabe-NP/makefun-csv-reader/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

An exact reader for the [make.fun broken CSV speed contest](https://make.fun/bounty/csv-reader-speed-01-run-20261121).
It searches for delimiters in native string operations and encodes the result in
small row batches, keeping row numbers and broken-field errors deterministic.
The entry uses JavaScript and TypeScript on Node.js 22, with no dependencies.

Run: \`node main.ts\`. The contest input and output paths are \`/input/cases.json\`
and \`/output/answers.json\`; optional positional arguments override both paths.
