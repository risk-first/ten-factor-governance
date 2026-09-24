/**
 * Webpack loader: parse YAML to a JS default export and attach the original
 * source text + basename as non-enumerable properties for client download.
 */
const path = require('path');
const {stringify} = require('javascript-stringify');
const YAML = require('yaml');

const makeIdIterator = (prefix = 'v', i = 1) => ({next: () => prefix + i++});

module.exports = function yamlWithSourceLoader(src) {
  const options = Object.assign({prettyErrors: true}, this.getOptions?.() ?? {});

  const refs = new Map();
  const idIter = makeIdIterator();
  function addRef(ref, count) {
    if (ref && typeof ref === 'object' && count > 1) {
      refs.set(ref, {id: idIter.next(), seen: false});
    }
  }
  const stringifyWithRefs = (value) =>
    stringify(value, (value, space, next) => {
      const v = refs.get(value);
      if (v) {
        if (v.seen) {
          return v.id;
        }
        v.seen = true;
      }
      return next(value);
    });

  const jsOpt = Object.assign({}, options, {
    namespace: undefined,
    onAnchor: addRef,
  });

  const doc = YAML.parseDocument(src, options);
  for (const warn of doc.warnings) {
    this.emitWarning(warn);
  }
  for (const err of doc.errors) {
    throw err;
  }
  const res = doc.toJS(jsOpt);
  const filename = path.basename(this.resourcePath);

  let str = '';
  for (const [obj, {id}] of refs.entries()) {
    str += `var ${id} = ${stringifyWithRefs(obj)};\n`;
  }
  str += `const __yamlData = ${stringifyWithRefs(res)};\n`;
  str += `if (__yamlData != null && typeof __yamlData === 'object') {\n`;
  str += `  Object.defineProperty(__yamlData, '__yamlSource', { value: ${JSON.stringify(src)}, enumerable: false });\n`;
  str += `  Object.defineProperty(__yamlData, '__yamlFilename', { value: ${JSON.stringify(filename)}, enumerable: false });\n`;
  str += `}\n`;
  str += `export default __yamlData;\n`;
  return str;
};
