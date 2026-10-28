# Fonts

`physics_game_v28.html` (and every edition built from it) carries Heebo and
Rubik **inside the page**, as `data:` URIs in the `<style>` right after the
`<meta name="referrer">` in `<head>`. Nothing is fetched from Google Fonts:
that sent every visitor's IP address, user agent and language to Google on
every page load, which for an audience of school students is a disclosure the
app does not need to make (it also failed on networks that block Google).

The bytes are Google Fonts' own woff2 subsets, unchanged, as served for the
CSS URL the page used before
(`css2?family=Heebo:wght@300..900&family=Rubik:wght@300;400;500;700;900`):

| Family | Subset | Source | Bytes | SHA-256 |
|---|---|---|---|---|
| Heebo | hebrew | `https://fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9H0TbFzsQ.woff2` | 12036 | `f1f7cfaef59431c7b391df81fb05520273303840bbe917213a2ab9f41b839675` |
| Heebo | math | `https://fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9GKTbFzsQ.woff2` | 23740 | `75dd1921c5eb014d83b32b864ea8d2f10f595ab5b25b166d06391fde1cc84cd1` |
| Heebo | symbols | `https://fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9GYTbFzsQ.woff2` | 14192 | `2fd251daf4ac2cc74a06acdb3d3c1037003a09b55709a60ea8e0bc7883721b3d` |
| Heebo | latin-ext | `https://fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9H4TbFzsQ.woff2` | 14748 | `dd3af41d4eac7f8b09b12d8d4a4bbf7ae13b0ff812560722d1a1d7c2077e02ea` |
| Heebo | latin | `https://fonts.gstatic.com/s/heebo/v28/NGS6v5_NC0k9P9H2TbE.woff2` | 30116 | `50dae2e12dae22c920388023e35aaebcd1e1d27bbe915c83d64210377e083e60` |
| Rubik | hebrew | `https://fonts.gstatic.com/s/rubik/v31/iJWKBXyIfDnIV7nDrXyi0A.woff2` | 9348 | `197b6dbe5c6bec7276c59b02d70a16ee6acd44322fc2f8d0226c07f8d57976c2` |
| Rubik | latin-ext | `https://fonts.gstatic.com/s/rubik/v31/iJWKBXyIfDnIV7nPrXyi0A.woff2` | 19400 | `09472f217ad1ebb61a7669cf532f9f2f80685e07652ee862fde9a79665aef479` |
| Rubik | latin | `https://fonts.gstatic.com/s/rubik/v31/iJWKBXyIfDnIV7nBrXw.woff2` | 35348 | `691cd1d9b4c0cdf31a1dcf04259c86f92c85e69f6622abab7964d81e36890691` |

Rubik's Arabic and Cyrillic subsets are left out (the app uses neither
script). The files are variable fonts: one face per subset covers Heebo's
300–900. Rubik is used only for the two titles, at 800 and 900, which Google
served at 900 for both, so its faces are declared at 900.

To check the embedded bytes against this table:

```sh
grep -o "base64,[A-Za-z0-9+/=]*" physics_game_v28.html | cut -c8- | while read b; do echo "$b" | base64 -d | sha256sum; done
```

Licence: SIL Open Font License 1.1, see [OFL.txt](OFL.txt).
