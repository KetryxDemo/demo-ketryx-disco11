'use strict';

// The programmer's third-party component inventory, published per released
// version as CycloneDX. Mirrors what the build emits.

const COMPONENTS = [
  { name: 'log4j-core', version: '2.14.1', purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1' },
  { name: 'jackson-databind', version: '2.9.10.3', purl: 'pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.9.10.3' },
  { name: 'okhttp', version: '4.9.0', purl: 'pkg:maven/com.squareup.okhttp3/okhttp@4.9.0' },
  { name: 'bcprov-jdk15on', version: '1.68', purl: 'pkg:maven/org.bouncycastle/bcprov-jdk15on@1.68' },
  { name: 'lodash', version: '4.17.15', purl: 'pkg:npm/lodash@4.17.15' },
  { name: 'axios', version: '0.21.0', purl: 'pkg:npm/axios@0.21.0' },
];

function buildBillOfMaterials(version) {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: {
      component: {
        type: 'application',
        name: 'neurocue-clinician-programmer',
        version,
      },
    },
    components: COMPONENTS.map((c) => ({ type: 'library', ...c })),
  };
}

module.exports = { buildBillOfMaterials, COMPONENTS };
