import React, {useMemo, useState} from 'react';
import DownloadYamlButton from '@site/src/components/DownloadYamlButton';
import RevealItem from '@site/src/components/RevealItem';
import styles from './styles.module.css';

function textOf(value) {
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function getCatalogEntries(catalog) {
  if (Array.isArray(catalog?.principles)) {
    return {entries: catalog.principles, entryLabel: 'principle'};
  }
  if (Array.isArray(catalog?.vectors)) {
    return {entries: catalog.vectors, entryLabel: 'vector'};
  }
  if (Array.isArray(catalog?.capabilities)) {
    return {entries: catalog.capabilities, entryLabel: 'capability'};
  }
  if (Array.isArray(catalog?.threats)) {
    return {entries: catalog.threats, entryLabel: 'threat'};
  }
  if (Array.isArray(catalog?.controls)) {
    return {entries: catalog.controls, entryLabel: 'control'};
  }
  if (Array.isArray(catalog?.guidelines)) {
    return {entries: catalog.guidelines, entryLabel: 'guideline'};
  }
  if (Array.isArray(catalog?.risks)) {
    return {entries: catalog.risks, entryLabel: 'risk'};
  }
  if (Array.isArray(catalog?.terms)) {
    return {
      entries: catalog.terms.map((term) => ({
        ...term,
        description: term.definition ?? term.description,
      })),
      entryLabel: 'term',
    };
  }
  if (catalog?.metadata?.type === 'Policy') {
    const plans = catalog.adherence?.['assessment-plans'] ?? [];
    return {
      entries: plans.map((plan) => ({
        id: plan.id,
        title: plan['requirement-id'] || plan.id,
        group: 'assessment-plans',
        description: textOf(plan['evidence-requirements']),
        frequency: plan.frequency,
        'evaluation-methods': plan['evaluation-methods'] ?? [],
      })),
      entryLabel: 'assessment plan',
    };
  }
  if (catalog?.metadata?.type === 'EvaluationLog') {
    return {
      entries: (catalog.evaluations ?? []).map((evaluation) => ({
        id: evaluation.name,
        title: evaluation.name,
        group: 'evaluations',
        description: textOf(evaluation.message),
        result: evaluation.result,
        control: evaluation.control,
        'assessment-logs': evaluation['assessment-logs'] ?? [],
      })),
      entryLabel: 'evaluation',
    };
  }
  if (catalog?.metadata?.type === 'EnforcementLog') {
    return {
      entries: (catalog.actions ?? []).map((action, index) => ({
        id: action.method?.['entry-id'] || `action-${index + 1}`,
        title: action.method?.['entry-id'] || `Action ${index + 1}`,
        group: 'actions',
        description: textOf(action.message),
        result: action.disposition,
        method: action.method,
        steps: action.steps ?? [],
      })),
      entryLabel: 'action',
    };
  }
  return {entries: [], entryLabel: 'entry'};
}

function indexEntriesById(catalog) {
  const {entries} = getCatalogEntries(catalog);
  const byId = new Map();
  for (const entry of entries) {
    byId.set(entry.id, entry);
  }
  return byId;
}

function indexGroupsById(catalog) {
  const byId = new Map();
  for (const group of catalog?.groups ?? []) {
    byId.set(group.id, group);
  }
  return byId;
}

/**
 * Expand catalog.imports against resolve catalogs into full entries.
 * Returns {entries, groups, missing, resolvedCount}.
 */
function resolveImportedEntries(imports, resolve) {
  if (!Array.isArray(imports) || imports.length === 0 || !resolve) {
    return {entries: [], groups: [], missing: [], resolvedCount: 0};
  }

  const entries = [];
  const groups = [];
  const missing = [];
  const seenEntry = new Set();
  const seenGroup = new Set();

  for (const mapping of imports) {
    const catalogKey = mapping['reference-id'];
    const source = resolve[catalogKey];
    if (!source) {
      for (const item of mapping.entries ?? []) {
        missing.push({catalog: catalogKey, id: item['reference-id']});
      }
      continue;
    }

    const byId = indexEntriesById(source);
    const groupsById = indexGroupsById(source);

    for (const item of mapping.entries ?? []) {
      const id = item['reference-id'];
      const found = byId.get(id);
      if (!found) {
        missing.push({catalog: catalogKey, id});
        continue;
      }
      if (seenEntry.has(id)) {
        continue;
      }
      seenEntry.add(id);
      entries.push({
        ...found,
        // Prefer remarks from the import statement as title fallback context.
        __importedFrom: catalogKey,
        __importRemarks: textOf(item.remarks),
      });
      const groupId = found.group;
      if (groupId && !seenGroup.has(groupId) && groupsById.has(groupId)) {
        seenGroup.add(groupId);
        groups.push(groupsById.get(groupId));
      }
    }
  }

  return {entries, groups, missing, resolvedCount: entries.length};
}

function mappingSections(entry) {
  return [
    {label: 'Principles', mappings: entry.principles},
    {label: 'Vectors', mappings: entry.vectors},
    {label: 'Capabilities', mappings: entry.capabilities},
    {label: 'Threats', mappings: entry.threats},
    {label: 'Guidelines', mappings: entry.guidelines},
  ].flatMap(({label, mappings}) =>
    (mappings ?? []).map((mapping) => ({label, mapping})),
  );
}

function flattenMappingIds(entry) {
  return mappingSections(entry).flatMap(({mapping}) =>
    (mapping.entries ?? []).flatMap((item) => [
      item['reference-id'],
      item.remarks,
    ]),
  );
}

function assessmentTexts(entry) {
  return (entry['assessment-requirements'] ?? []).flatMap((requirement) => [
    requirement.id,
    requirement.text,
    requirement.recommendation,
    ...(requirement.applicability ?? []),
  ]);
}

function matchesQuery(entry, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    entry.id,
    entry.title,
    entry.description,
    entry.objective,
    entry.definition,
    entry.impact,
    entry.severity,
    entry.frequency,
    entry.result,
    ...(entry.synonyms ?? []),
    ...(entry.steps ?? []),
    entry.__importedFrom,
    entry.__importRemarks,
    ...(entry.__externalMappings ?? []).flatMap((section) => [
      section.framework,
      section.relationship,
      ...section.targets.flatMap((target) => [
        target['entry-id'],
        target.remarks,
      ]),
    ]),
    ...flattenMappingIds(entry),
    ...assessmentTexts(entry),
  ]
    .map(textOf)
    .join('\n')
    .toLowerCase();
  return haystack.includes(query);
}

/** Doc pages for known Gemara catalog reference-ids (imports). */
const CATALOG_HREF = {
  'CCC.K8S.Capabilities': '/docs/artifacts/finos/ccc-k8s/capabilities-catalog',
  'CCC.K8S.Threats': '/docs/artifacts/finos/ccc-k8s/threats-catalog',
  'CCC.K8S.Controls': '/docs/artifacts/finos/ccc-k8s/controls-catalog',
  'CCC.K8S.TH': '/docs/artifacts/finos/ccc-k8s/threats-catalog',
  'AIR-PRIN': '/docs/artifacts/finos/ai-governance/principles-catalog',
  'AIR-VEC': '/docs/artifacts/finos/ai-governance/vectors-catalog',
  'FINOS-AIR': '/docs/artifacts/finos/ai-governance/guidance-catalog',
  'foss-contribution-lexicon': '/docs/artifacts/finos/foss-contribution/lexicon',
  'foss-contribution-principles':
    '/docs/artifacts/finos/foss-contribution/principles-catalog',
  'foss-contribution-vectors':
    '/docs/artifacts/finos/foss-contribution/vectors-catalog',
  'foss-contribution-guidance':
    '/docs/artifacts/finos/foss-contribution/guidance-catalog',
  'foss-contribution-capabilities':
    '/docs/artifacts/finos/foss-contribution/capabilities-catalog',
  'foss-contribution-threat-catalog':
    '/docs/artifacts/finos/foss-contribution/threats-catalog',
  'foss-contribution-controls':
    '/docs/artifacts/finos/foss-contribution/controls-catalog',
  'foss-risk-catalog': '/docs/artifacts/finos/foss-contribution/risks-catalog',
  'foss-contribution-policy': '/docs/artifacts/finos/foss-contribution/policy',
  'foss-eval-commons-lang-pr482':
    '/docs/artifacts/finos/foss-contribution/evaluation-commons-lang-pr482',
  'foss-eval-internal-tools-pr417':
    '/docs/artifacts/finos/foss-contribution/evaluation-internal-tools-pr417',
  'foss-enforcement-internal-tools-pr417':
    '/docs/artifacts/finos/foss-contribution/enforcement-internal-tools-pr417',
};

/** Optional external URLs for MappingDocument target frameworks. */
const FRAMEWORK_HREF = {
  CWE: 'https://cwe.mitre.org/',
  'MITRE-ATT&CK': 'https://attack.mitre.org/',
};

function CatalogRef({id}) {
  const href = CATALOG_HREF[id];
  if (!href) {
    return <code>{id}</code>;
  }
  return (
    <a href={href}>
      <code>{id}</code>
    </a>
  );
}

function MappingList({entry}) {
  const sections = mappingSections(entry).filter(
    ({mapping}) => (mapping.entries ?? []).length > 0,
  );
  if (sections.length === 0) {
    return null;
  }

  return (
    <>
      {sections.map(({label, mapping}) => (
        <div
          key={`${entry.id}-${label}-${mapping['reference-id']}`}
          className={styles.mappingBlock}
        >
          <span className={styles.sectionLabel}>
            {label} <CatalogRef id={mapping['reference-id']} />
          </span>
          <ul className={styles.mappingList}>
            {(mapping.entries ?? []).map((item) => (
              <li key={item['reference-id']} className={styles.mappingItem}>
                <code>{item['reference-id']}</code>
                {textOf(item.remarks) ? (
                  <span className={styles.mappingRemarks}>
                    {textOf(item.remarks)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function AssessmentRequirements({entry}) {
  const requirements = entry['assessment-requirements'] ?? [];
  if (requirements.length === 0) {
    return null;
  }

  return (
    <div className={styles.assessmentBlock}>
      <span className={styles.sectionLabel}>Assessment Requirements</span>
      <ul className={styles.assessmentList}>
        {requirements.map((requirement) => (
          <li key={requirement.id} className={styles.assessmentItem} id={requirement.id}>
            <code className={styles.assessmentId}>{requirement.id}</code>
            {textOf(requirement.text) ? (
              <p className={styles.assessmentText}>{textOf(requirement.text)}</p>
            ) : null}
            {(requirement.applicability ?? []).length > 0 ? (
              <p className={styles.applicability}>
                Applicability:{' '}
                {requirement.applicability.map((value) => (
                  <code key={value} className={styles.applicabilityTag}>
                    {value}
                  </code>
                ))}
              </p>
            ) : null}
            {textOf(requirement.recommendation) ? (
              <p className={styles.recommendation}>
                <span className={styles.recommendationLabel}>Recommendation: </span>
                {textOf(requirement.recommendation)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnresolvedImports({missing}) {
  if (!missing.length) {
    return null;
  }
  return (
    <p className={styles.empty}>
      Could not resolve {missing.length} import
      {missing.length === 1 ? '' : 's'}:{' '}
      {missing.map((item) => `${item.catalog}/${item.id}`).join(', ')}
    </p>
  );
}

/**
 * Index MappingDocuments by source entry id so threats/controls can show
 * external framework links (CWE, MITRE ATT&CK, …) inline.
 */
function indexExternalMappings(mappingDocs) {
  const bySource = new Map();
  for (const doc of mappingDocs ?? []) {
    if (!doc) {
      continue;
    }
    const framework =
      doc['target-reference']?.['reference-id'] ??
      doc.metadata?.id ??
      'External';
    const refs = doc.metadata?.['mapping-references'] ?? [];
    const frameworkRef = refs.find((ref) => ref.id === framework);
    const url = frameworkRef?.url || FRAMEWORK_HREF[framework] || null;
    const title = frameworkRef?.title || framework;

    for (const row of doc.mappings ?? []) {
      const source = row.source;
      if (!source) {
        continue;
      }
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source).push({
        framework,
        title,
        url,
        relationship: row.relationship,
        targets: row.targets ?? [],
      });
    }
  }
  return bySource;
}

function attachExternalMappings(entries, bySource) {
  if (!bySource || bySource.size === 0) {
    return entries;
  }
  return entries.map((entry) => ({
    ...entry,
    __externalMappings: bySource.get(entry.id) ?? [],
  }));
}

function FrameworkRef({section}) {
  if (section.url) {
    return (
      <a href={section.url} target="_blank" rel="noopener noreferrer">
        {section.title}
      </a>
    );
  }
  return <span>{section.title}</span>;
}

function ExternalMappings({entry}) {
  const sections = entry.__externalMappings ?? [];
  if (sections.length === 0) {
    return null;
  }
  return (
    <div className={styles.externalMappings}>
      {sections.map((section) => (
        <div
          key={`${entry.id}-${section.framework}`}
          className={styles.mappingBlock}
        >
          <span className={styles.sectionLabel}>
            <FrameworkRef section={section} />
            {textOf(section.relationship) ? (
              <span className={styles.relationship}>
                {' '}
                ({section.relationship})
              </span>
            ) : null}
          </span>
          <ul className={styles.mappingList}>
            {section.targets.map((target) => (
              <li key={target['entry-id']} className={styles.mappingItem}>
                <code>{target['entry-id']}</code>
                {textOf(target.remarks) ? (
                  <span className={styles.mappingRemarks}>
                    {textOf(target.remarks)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EntryBody({entry}) {
  const methods = entry['evaluation-methods'] ?? [];
  const assessmentLogs = entry['assessment-logs'] ?? [];
  const steps = entry.steps ?? [];
  return (
    <>
      {entry.__importedFrom ? (
        <p className={styles.importedNote}>
          Imported from <CatalogRef id={entry.__importedFrom} />
        </p>
      ) : null}
      {entry.result ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Result</span>{' '}
          <code>{entry.result}</code>
        </p>
      ) : null}
      {entry.severity ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Severity</span>{' '}
          {entry.severity}
        </p>
      ) : null}
      {entry.frequency ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Frequency</span>{' '}
          {entry.frequency}
        </p>
      ) : null}
      {(entry.synonyms ?? []).length > 0 ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Synonyms</span>{' '}
          {entry.synonyms.join(', ')}
        </p>
      ) : null}
      {entry.control?.['entry-id'] ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Control</span>{' '}
          <code>{entry.control['entry-id']}</code>
        </p>
      ) : null}
      {entry.method?.['entry-id'] ? (
        <p className={styles.metaInline}>
          <span className={styles.sectionLabel}>Method</span>{' '}
          <code>{entry.method['entry-id']}</code>
        </p>
      ) : null}
      {textOf(entry.objective) ? (
        <div className={styles.description}>
          <span className={styles.sectionLabel}>Objective</span>
          <p className={styles.descriptionText}>{textOf(entry.objective)}</p>
        </div>
      ) : null}
      {(entry.statements ?? []).length > 0 ? (
        <div className={styles.mappingBlock}>
          <span className={styles.sectionLabel}>Statements</span>
          <ul className={styles.mappingList}>
            {entry.statements.map((statement) => (
              <li
                key={statement.id || textOf(statement.text)}
                className={styles.mappingItem}
              >
                {statement.id ? <code>{statement.id}</code> : null}
                <span className={styles.mappingRemarks}>
                  {textOf(statement.title)
                    ? `${textOf(statement.title)} — ${textOf(statement.text)}`
                    : textOf(statement.text)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {textOf(entry.description) ? (
        <div className={styles.description}>
          <span className={styles.sectionLabel}>
            {entry.definition ? 'Definition' : 'Description'}
          </span>
          <p className={styles.descriptionText}>{textOf(entry.description)}</p>
        </div>
      ) : null}
      {textOf(entry.impact) ? (
        <div className={styles.description}>
          <span className={styles.sectionLabel}>Impact</span>
          <p className={styles.descriptionText}>{textOf(entry.impact)}</p>
        </div>
      ) : null}
      {methods.length > 0 ? (
        <div className={styles.mappingBlock}>
          <span className={styles.sectionLabel}>Evaluation Methods</span>
          <ul className={styles.mappingList}>
            {methods.map((method) => (
              <li key={method.id} className={styles.mappingItem}>
                <code>{method.id}</code>
                <span className={styles.mappingRemarks}>
                  {[method.type, method.mode, method.description]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {assessmentLogs.length > 0 ? (
        <div className={styles.mappingBlock}>
          <span className={styles.sectionLabel}>Assessment Logs</span>
          <ul className={styles.mappingList}>
            {assessmentLogs.map((log, index) => (
              <li
                key={`${entry.id}-assessment-${index}`}
                className={styles.mappingItem}
              >
                <code>{log.result}</code>
                {textOf(log.message) ? (
                  <span className={styles.mappingRemarks}>
                    {textOf(log.message)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {steps.length > 0 ? (
        <div className={styles.mappingBlock}>
          <span className={styles.sectionLabel}>Steps</span>
          <ul className={styles.mappingList}>
            {steps.map((step) => (
              <li key={step} className={styles.mappingItem}>
                <code>{step}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <AssessmentRequirements entry={entry} />
      <MappingList entry={entry} />
      <ExternalMappings entry={entry} />
    </>
  );
}

function groupEntries(entries, groups, normalizedQuery) {
  const byGroup = new Map();
  for (const entry of entries) {
    if (!matchesQuery(entry, normalizedQuery)) {
      continue;
    }
    const key = entry.group || 'ungrouped';
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
    }
    byGroup.get(key).push(entry);
  }

  const ordered = [];
  for (const group of groups) {
    if (byGroup.has(group.id)) {
      ordered.push({group, entries: byGroup.get(group.id)});
      byGroup.delete(group.id);
    }
  }
  for (const [id, list] of byGroup) {
    ordered.push({group: {id, title: id}, entries: list});
  }
  return ordered;
}

/**
 * Renders a Gemara catalog. Pass `resolve` to inline imported entries from
 * other catalogs (keyed by the import `reference-id`, e.g. CCC.Core.Capabilities).
 * Pass `mappings` (MappingDocument objects) to attach external framework
 * targets (CWE, MITRE ATT&CK, …) onto matching entry ids.
 *
 * ```mdx
 * <GemaraCatalog
 *   file={k8sThreats}
 *   resolve={{'CCC.Core.Threats': coreThreats}}
 *   mappings={[threatsCwe, threatsMitreAttack]}
 * />
 * ```
 */
export default function GemaraCatalog({file, resolve, mappings}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const catalog = file ?? {};
  const metadata = catalog.metadata ?? {};
  const localGroups = catalog.groups ?? [];
  const imports = catalog.imports ?? [];
  const {entries: localEntries, entryLabel} = getCatalogEntries(catalog);

  const {
    entries: importedEntries,
    groups: importedGroups,
    missing,
    resolvedCount,
  } = useMemo(
    () => resolveImportedEntries(imports, resolve),
    [imports, resolve],
  );

  const externalBySource = useMemo(
    () => indexExternalMappings(mappings),
    [mappings],
  );

  // When resolve is provided, fold imports into the main list and drop the
  // dangling-import summary. Otherwise keep the old imports listing.
  const expandImports = Boolean(resolve) && imports.length > 0;
  const entries = useMemo(() => {
    const base = expandImports
      ? [...localEntries, ...importedEntries]
      : localEntries;
    return attachExternalMappings(base, externalBySource);
  }, [expandImports, localEntries, importedEntries, externalBySource]);

  // Local groups first (service catalog order), then any Core groups only
  // needed by resolved imports.
  const groups = useMemo(() => {
    if (entryLabel === 'term' && localGroups.length === 0) {
      return [{id: 'terms', title: 'Terms'}];
    }
    if (entryLabel === 'assessment plan' && localGroups.length === 0) {
      return [{id: 'assessment-plans', title: 'Assessment Plans'}];
    }
    if (entryLabel === 'evaluation' && localGroups.length === 0) {
      return [{id: 'evaluations', title: 'Evaluations'}];
    }
    if (entryLabel === 'action' && localGroups.length === 0) {
      return [{id: 'actions', title: 'Actions'}];
    }
    if (!expandImports) {
      return localGroups;
    }
    const seen = new Set(localGroups.map((group) => group.id));
    const merged = [...localGroups];
    for (const group of importedGroups) {
      if (!seen.has(group.id)) {
        seen.add(group.id);
        merged.push(group);
      }
    }
    return merged;
  }, [entryLabel, expandImports, localGroups, importedGroups]);

  // Lexicon terms have no group field — put them all under "terms".
  const entriesForGrouping = useMemo(() => {
    if (entryLabel !== 'term') {
      return entries;
    }
    return entries.map((entry) => ({...entry, group: entry.group || 'terms'}));
  }, [entryLabel, entries]);

  const grouped = useMemo(
    () => groupEntries(entriesForGrouping, groups, normalizedQuery),
    [entriesForGrouping, groups, normalizedQuery],
  );

  if (!file) {
    return (
      <p className={styles.empty}>
        <code>GemaraCatalog</code> requires a <code>file</code> prop.
      </p>
    );
  }

  const visibleCount = grouped.reduce(
    (sum, entry) => sum + entry.entries.length,
    0,
  );

  return (
    <div className={styles.catalog}>
      <div className={styles.header}>
        <div className={styles.badges}>
          <span className={styles.badge}>{metadata.type ?? 'Catalog'}</span>
          {catalog.type ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              {catalog.type}
            </span>
          ) : null}
          {metadata.version ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              v{metadata.version}
            </span>
          ) : null}
          {metadata.draft ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>draft</span>
          ) : null}
          {catalog.result ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              {catalog.result}
            </span>
          ) : null}
          {catalog.disposition ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>
              {catalog.disposition}
            </span>
          ) : null}
        </div>
        <DownloadYamlButton
          file={file}
          resolve={resolve}
          mappings={mappings}
        />
      </div>

      {textOf(metadata.description) ? (
        <div className={styles.frontMatter}>{textOf(metadata.description)}</div>
      ) : null}

      {!expandImports ? (
        imports.length > 0 ? (
          <section className={styles.imports} aria-label="Imports">
            <h2 className={styles.groupTitle}>Imports</h2>
            {imports.map((mapping) => (
              <div
                key={mapping['reference-id']}
                className={styles.mappingBlock}
              >
                <span className={styles.sectionLabel}>
                  <CatalogRef id={mapping['reference-id']} />
                </span>
                <ul className={styles.mappingList}>
                  {(mapping.entries ?? []).map((item) => (
                    <li key={item['reference-id']} className={styles.mappingItem}>
                      <code>{item['reference-id']}</code>
                      {textOf(item.remarks) ? (
                        <span className={styles.mappingRemarks}>
                          {textOf(item.remarks)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null
      ) : (
        <UnresolvedImports missing={missing} />
      )}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${entryLabel}s by id, title or text…`}
          aria-label={`Filter ${entryLabel}s`}
        />
        <p className={styles.count}>
          Showing {visibleCount} of {entries.length}
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className={styles.empty}>No entries match this filter.</p>
      ) : (
        grouped.map(({group, entries: groupEntries}) => (
          <section
            key={group.id}
            className={styles.group}
            id={`group-${group.id}`}
          >
            <h2 className={styles.groupTitle}>{group.title ?? group.id}</h2>
            {textOf(group.description) ? (
              <p className={styles.groupDesc}>{textOf(group.description)}</p>
            ) : null}
            <div className={styles.entryList}>
              {groupEntries.map((entry) => (
                <div key={entry.id} id={entry.id}>
                  <RevealItem
                    title={
                      <>
                        <span className={styles.entryId}>{entry.id}</span>
                        {entry.title}
                        {entry.__importedFrom ? (
                          <span className={styles.importedBadge}>imported</span>
                        ) : null}
                      </>
                    }
                  >
                    <EntryBody entry={entry} />
                  </RevealItem>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
