/**
 * Direct structure-lint config: web-core's own module-contract preset run
 * against this repo. The preset ships to consumers via qlty, but this repo is
 * the package, so it dogfoods with a direct eslint run (see `lint:structure`).
 * `--no-inline-config` keeps eslint from resolving the shared standards'
 * disable directives, which this run does not load.
 *
 * @author      Ben Carey <bdmc@sinemacula.co.uk>
 * @copyright   2026 Sine Macula Limited
 */

import webCore from './eslint/index.js';

export default webCore;
