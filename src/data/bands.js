/**
 * The governance lifecycle bands every artifact belongs to.
 *
 * One band vocabulary is shared across catalogs so a colour means the same
 * thing wherever it appears. Each catalog reaches it by its own name: Gemara
 * pages are tagged `Layer 1`…`Layer 7`, other catalogs are tagged with the
 * band label itself. Colours live in `src/css/custom.css` under
 * `--gf-band-*`, and are applied by setting `data-band` on an element.
 */
export const BANDS = [
  {
    key: 'define',
    number: 1,
    label: 'Define',
    blurb: 'What good looks like',
  },
  {
    key: 'assess',
    number: 2,
    label: 'Assess',
    blurb: 'What could go wrong and what would stop it',
  },
  {
    key: 'decide',
    number: 3,
    label: 'Decide',
    blurb: 'What we accept and what we require',
  },
  {
    key: 'operate',
    number: 4,
    label: 'Operate',
    blurb: 'The activity and resources being governed',
  },
  {
    key: 'evaluate',
    number: 5,
    label: 'Evaluate',
    blurb: 'Whether the requirements are met',
  },
  {
    key: 'enforce',
    number: 6,
    label: 'Enforce',
    blurb: 'What happens when they are not',
  },
  {
    key: 'assure',
    number: 7,
    label: 'Assure',
    blurb: 'Evidence the whole thing works',
  },
  {
    key: 'cross',
    number: null,
    label: 'Cross-cutting',
    blurb: 'Referenced from every band',
  },
];

const BY_KEY = new Map(BANDS.map((band) => [band.key, band]));
const BY_NUMBER = new Map(
  BANDS.filter((band) => band.number).map((band) => [band.number, band]),
);
const BY_LABEL = new Map(
  BANDS.map((band) => [band.label.toLowerCase(), band]),
);

export function bandByKey(key) {
  return BY_KEY.get(key) ?? null;
}

/** Resolves a band from a tag label, a layer number, or a band key. */
export function bandFrom(value) {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return BY_NUMBER.get(value) ?? null;
  }
  const text = String(value).trim();
  const layer = /^Layer (\d+)$/i.exec(text);
  if (layer) {
    return BY_NUMBER.get(Number(layer[1])) ?? null;
  }
  if (/^cross(-cutting)?$/i.test(text)) {
    return BY_KEY.get('cross');
  }
  return BY_KEY.get(text.toLowerCase()) ?? BY_LABEL.get(text.toLowerCase()) ?? null;
}

/** First band named by a doc's tags, which may be objects or plain strings. */
export function bandFromTags(tags = []) {
  for (const tag of tags) {
    const band = bandFrom(tag?.label ?? tag);
    if (band) {
      return band;
    }
  }
  return null;
}
