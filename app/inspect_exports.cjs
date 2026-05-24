const router = require('./node_modules/react-router/dist/development/dom-export.js');
const core = require('./node_modules/react-router/dist/development/index.js');

console.log('=== dom-export.js ===');
console.log(Object.keys(router).sort().join(', '));

console.log('\n=== index.js (core) ===');
console.log(Object.keys(core).sort().join(', '));
