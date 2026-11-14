# Third-party notices

CleanShield includes adult-domain blocklist data derived from two separately
maintained upstream projects. The datasets are retained separately in
`blocklists/sources/`; the generated rules in `rules/` combine them as described
in `BLOCKLIST-SOURCE.md`.

## Sinfonietta / hostfiles

- Source file: `blocklists/sources/sinfonietta-pornography-hosts.txt`
- Upstream file: https://github.com/Sinfonietta/hostfiles/blob/master/pornography-hosts
- Repository: https://github.com/Sinfonietta/hostfiles
- Repository licence: MIT
- Copyright notice: Copyright (c) 2016 Sinfonietta
- Full licence text: `LICENSES/Sinfonietta-MIT.txt`

## ShadowWhisperer / BlockLists

- Source file: `blocklists/sources/shadowwhisperer-adult.txt`
- Upstream file: https://github.com/ShadowWhisperer/BlockLists/blob/master/Lists/Adult
- Repository: https://github.com/ShadowWhisperer/BlockLists
- Repository licence: Unlicense
- Full licence text: `LICENSES/ShadowWhisperer-Unlicense.txt`

The two upstream sources retain their own separate licensing notices. The
combined CleanShield-generated rules are derived data and should not be
misrepresented as having one single upstream licence. Preserve these notices
when redistributing the generated data. The original source snapshots and
reproducible generation scripts are retained in the public source repository.

The upstream lists are community-maintained classifications. They may contain
stale entries or false positives and are provided without a guarantee that
every listed hostname currently serves adult content. Users should be able to
report possible false positives through the support contact published in the
Chrome Web Store listing. Before publishing, configure a monitored support
contact and review reports as part of the documented blocklist update process.
