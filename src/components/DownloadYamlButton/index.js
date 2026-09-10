import React, {useEffect, useMemo, useRef, useState} from 'react';
import {stringify as yamlStringify} from 'yaml';
import styles from './styles.module.css';

function textOf(value) {
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function yamlTextFrom(data) {
  if (data != null && typeof data === 'object' && data.__yamlSource) {
    return data.__yamlSource;
  }
  return yamlStringify(data ?? {}, {lineWidth: 0});
}

function filenameFrom(data, fallback = 'catalog.yaml') {
  if (data != null && typeof data === 'object' && data.__yamlFilename) {
    return data.__yamlFilename;
  }
  const id = textOf(data?.metadata?.id) || textOf(data?.title);
  if (id) {
    return `${id.replace(/[^a-zA-Z0-9._-]+/g, '-')}.yaml`;
  }
  return fallback;
}

function downloadText(text, filename) {
  const blob = new Blob([text], {type: 'text/yaml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function collectSources({file, resolve, mappings}) {
  const sources = [];
  if (file) {
    sources.push({
      key: 'primary',
      label: 'Catalog',
      data: file,
      filename: filenameFrom(file),
    });
  }
  if (resolve && typeof resolve === 'object') {
    for (const [referenceId, data] of Object.entries(resolve)) {
      if (!data) {
        continue;
      }
      sources.push({
        key: `resolve:${referenceId}`,
        label: referenceId,
        data,
        filename: filenameFrom(data, `${referenceId}.yaml`),
      });
    }
  }
  if (Array.isArray(mappings)) {
    mappings.forEach((data, index) => {
      if (!data) {
        return;
      }
      const label =
        textOf(data.metadata?.id) ||
        textOf(data.title) ||
        `mapping-${index + 1}`;
      sources.push({
        key: `mapping:${label}:${index}`,
        label,
        data,
        filename: filenameFrom(data, `mapping-${index + 1}.yaml`),
      });
    });
  }
  return sources;
}

/**
 * Downloads original YAML for a Gemara document (and optional related imports /
 * mapping documents when provided).
 */
export default function DownloadYamlButton({file, resolve, mappings}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const sources = useMemo(
    () => collectSources({file, resolve, mappings}),
    [file, resolve, mappings],
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (sources.length === 0) {
    return null;
  }

  const downloadOne = (source) => {
    downloadText(yamlTextFrom(source.data), source.filename);
    setOpen(false);
  };

  if (sources.length === 1) {
    return (
      <button
        type="button"
        className={styles.button}
        onClick={() => downloadOne(sources[0])}
      >
        Download YAML Source
      </button>
    );
  }

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        Download YAML Source
        <span className={styles.chevron} aria-hidden="true" />
      </button>
      {open ? (
        <ul className={styles.menuList} role="menu">
          {sources.map((source) => (
            <li key={source.key} role="none">
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                onClick={() => downloadOne(source)}
              >
                <span className={styles.menuLabel}>{source.label}</span>
                <code className={styles.menuFilename}>{source.filename}</code>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
