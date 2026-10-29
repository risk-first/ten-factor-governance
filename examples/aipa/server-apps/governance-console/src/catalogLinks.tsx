import type { ReactElement, ReactNode } from 'react';
import type { ArtifactReference, LinkResolver } from '@gemara/react/provider';
import type { EnforcementLogData, EvaluationLogData } from '@gemara/react';

export const DEFAULT_CONTROLS_CATALOG_URL =
  'https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/gemara/components/ai-portfolio-assistant/controls-catalog';
export const DEFAULT_POLICY_URL =
  'https://tenfactorgovernance.org/docs/artifacts/finos/ai-portfolio-assistant/gemara/policy';

export type CatalogUrls = {
  controlsCatalogUrl: string;
  policyUrl: string;
};

export const DEFAULT_CATALOG_URLS: CatalogUrls = {
  controlsCatalogUrl: DEFAULT_CONTROLS_CATALOG_URL,
  policyUrl: DEFAULT_POLICY_URL,
};

type GemaraLog = EvaluationLogData | EnforcementLogData;

const CONTROLS_REF = 'apa-controls';
const POLICY_REF = 'apa-policy';
const CONTROLS_ENTRY_IDS = new Set([
  'apa-ctl-005-propose-human-approval',
  'apa-ctl-005-propose-human-approval.ar01',
]);

function catalogBaseUrl(ref: ArtifactReference, catalogs: CatalogUrls): string | undefined {
  if (ref.url) return ref.url.split('#')[0];
  const referenceId = ref.referenceId ?? (ref.kind === 'mapping-reference' ? ref.id : undefined);
  if (referenceId === CONTROLS_REF || CONTROLS_ENTRY_IDS.has(ref.id)) {
    return catalogs.controlsCatalogUrl;
  }
  if (referenceId === POLICY_REF) return catalogs.policyUrl;
  return undefined;
}

function catalogHref(ref: ArtifactReference, catalogs: CatalogUrls): string | undefined {
  const base = catalogBaseUrl(ref, catalogs);
  if (!base) return undefined;
  if (ref.kind === 'entry' && ref.id) return `${base}#${ref.id}`;
  return base;
}

export function makeCatalogLinkResolver(catalogs: CatalogUrls): LinkResolver {
  return (ref: ArtifactReference, children: ReactNode): ReactElement => {
    const href = catalogHref(ref, catalogs);
    if (!href) {
      return (
        <span data-gemara-ref={ref.kind} data-gemara-ref-id={ref.id}>
          {children}
        </span>
      );
    }
    return (
      <a
        href={href}
        data-gemara-ref={ref.kind}
        data-gemara-ref-id={ref.id}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  };
}

export function withCatalogUrls<T extends GemaraLog>(log: T, catalogs: CatalogUrls): T {
  const refs = log.metadata?.['mapping-references'];
  if (!refs?.length) return log;
  return {
    ...log,
    metadata: {
      ...log.metadata,
      'mapping-references': refs.map(ref => {
        if (ref.id === 'apa-controls') return { ...ref, url: catalogs.controlsCatalogUrl };
        if (ref.id === 'apa-policy') return { ...ref, url: catalogs.policyUrl };
        return ref;
      }),
    },
  };
}
