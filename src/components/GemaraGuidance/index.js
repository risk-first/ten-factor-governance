import React, {useMemo, useState} from 'react';
import RevealItem from '@site/src/components/RevealItem';
import styles from './styles.module.css';

function textOf(value) {
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function matchesQuery(guideline, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    guideline.id,
    guideline.title,
    guideline.objective,
    ...(guideline.statements ?? []).flatMap((s) => [s.id, s.title, s.text]),
    ...(guideline.recommendations ?? []),
  ]
    .map(textOf)
    .join('\n')
    .toLowerCase();
  return haystack.includes(query);
}

function Guideline({guideline}) {
  const objective = textOf(guideline.objective);
  const statements = guideline.statements ?? [];
  const recommendations = guideline.recommendations ?? [];

  return (
    <>
      {objective ? (
        <div className={styles.objective}>
          <span className={styles.sectionLabel}>Objective</span>
          <p className={styles.objectiveText}>{objective}</p>
        </div>
      ) : null}

      {statements.length > 0 ? (
        <>
          <span className={styles.sectionLabel}>Statements</span>
          <ul className={styles.statements}>
            {statements.map((statement) => (
              <li key={statement.id} className={styles.statement} id={statement.id}>
                <code className={styles.statementId}>{statement.id}</code>
                {statement.title ? (
                  <div className={styles.statementTitle}>{statement.title}</div>
                ) : null}
                <p className={styles.statementText}>{textOf(statement.text)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {recommendations.length > 0 ? (
        <>
          <span className={styles.sectionLabel}>Recommendations</span>
          <ul className={styles.recommendations}>
            {recommendations.map((rec, index) => (
              <li key={`${guideline.id}-rec-${index}`}>{rec}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/**
 * Renders a Gemara GuidanceCatalog document inside a regular doc page.
 *
 * ```mdx
 * import iso27001 from '@site/src/data/iso-iec-27001-2022-guidance.yaml';
 *
 * <GemaraGuidance file={iso27001} />
 * ```
 *
 * @param {object} props
 * @param {object} props.file - Parsed GuidanceCatalog (imported YAML or JSON)
 * @param {boolean} [props.showFrontMatter=true] - Render the catalog `front-matter`
 * @param {boolean} [props.showExemptions=true] - Render the catalog `exemptions`
 */
export default function GemaraGuidance({
  file,
  showFrontMatter = true,
  showExemptions = true,
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const catalog = file ?? {};
  const metadata = catalog.metadata ?? {};
  const groups = catalog.groups ?? [];
  const guidelines = catalog.guidelines ?? [];
  const exemptions = catalog.exemptions ?? [];

  const grouped = useMemo(() => {
    const byGroup = new Map();
    for (const guideline of guidelines) {
      if (!matchesQuery(guideline, normalizedQuery)) {
        continue;
      }
      const key = guideline.group || 'ungrouped';
      if (!byGroup.has(key)) {
        byGroup.set(key, []);
      }
      byGroup.get(key).push(guideline);
    }

    // Declared group order first, then anything referencing an unknown group.
    const ordered = [];
    for (const group of groups) {
      if (byGroup.has(group.id)) {
        ordered.push({group, guidelines: byGroup.get(group.id)});
        byGroup.delete(group.id);
      }
    }
    for (const [id, list] of byGroup) {
      ordered.push({group: {id, title: id}, guidelines: list});
    }
    return ordered;
  }, [groups, guidelines, normalizedQuery]);

  if (!file) {
    return (
      <p className={styles.empty}>
        <code>GemaraGuidance</code> requires a <code>file</code> prop.
      </p>
    );
  }

  const visibleCount = grouped.reduce(
    (sum, entry) => sum + entry.guidelines.length,
    0,
  );

  return (
    <div className={styles.catalog}>
      <div className={styles.badges}>
        <span className={styles.badge}>
          {metadata.type ?? 'GuidanceCatalog'}
        </span>
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
      </div>

      <p className={styles.meta}>
        {metadata.id ? (
          <>
            <code>{metadata.id}</code>
            {' · '}
          </>
        ) : null}
        {guidelines.length} guideline{guidelines.length === 1 ? '' : 's'}
      </p>

      {showFrontMatter && textOf(catalog['front-matter']) ? (
        <div className={styles.frontMatter}>
          {textOf(catalog['front-matter'])}
        </div>
      ) : null}

      {showExemptions && exemptions.length > 0 ? (
        <section className={styles.exemptions} aria-label="Exemptions">
          <h2 className={styles.groupTitle}>Exemptions</h2>
          {exemptions.map((exemption, index) => (
            <div key={`exemption-${index}`} className={styles.exemption}>
              <div className={styles.exemptionTitle}>{exemption.description}</div>
              <p className={styles.exemptionReason}>{textOf(exemption.reason)}</p>
              {exemption.redirect ? (
                <p className={styles.meta}>Redirect: {exemption.redirect}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter guidelines by id, title or text…"
          aria-label="Filter guidelines"
        />
        <p className={styles.count}>
          Showing {visibleCount} of {guidelines.length}
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className={styles.empty}>No guidelines match this filter.</p>
      ) : (
        grouped.map(({group, guidelines: groupGuidelines}) => (
          <section
            key={group.id}
            className={styles.group}
            id={`group-${group.id}`}
          >
            <h2 className={styles.groupTitle}>{group.title ?? group.id}</h2>
            {textOf(group.description) ? (
              <p className={styles.groupDesc}>{textOf(group.description)}</p>
            ) : null}
            <div className={styles.guidelineList}>
              {groupGuidelines.map((guideline) => (
                <div key={guideline.id} id={guideline.id}>
                  <RevealItem
                    title={
                      <>
                        <span className={styles.guidelineId}>
                          {guideline.id}
                        </span>
                        {guideline.title}
                      </>
                    }
                  >
                    <Guideline guideline={guideline} />
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
