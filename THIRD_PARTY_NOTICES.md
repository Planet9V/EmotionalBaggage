# Third-party notices

Generated from package-lock.json at commit ebbdb17 by `npm run notices`; do not edit by hand.

Every third-party component this repository uses: the npm packages of the web app's production dependency tree (direct and transitive), the Python packages the planner installs, and the material no package manager knows about (container images, fonts, copied source). The page shown in the app, with how each direct component is used and the attestation, is `docs/guide/code-use.md`.

## npm packages (production tree)

548 packages: 40 direct, 508 transitive. 33 of them are platform-specific builds (marked "platform build"); npm installs only the ones matching the machine, and their licence is taken from package-lock.json and their link is the npm page. All other licences are read from the installed packages by license-checker-rseidelsohn.

| Package | Version | Licence | Repository | Kind |
| --- | --- | --- | --- | --- |
| @ai-sdk/gateway | 4.0.152 | Apache-2.0 | https://github.com/vercel/ai | transitive |
| @ai-sdk/mcp | 2.0.102 | Apache-2.0 | https://github.com/vercel/ai | transitive |
| @ai-sdk/openai-compatible | 3.0.94 | Apache-2.0 | https://github.com/vercel/ai | direct |
| @ai-sdk/provider | 4.0.39 | Apache-2.0 | https://github.com/vercel/ai | transitive |
| @ai-sdk/provider-utils | 5.0.83 | Apache-2.0 | https://github.com/vercel/ai | transitive |
| @ai-sdk/react | 4.0.183 | Apache-2.0 | https://github.com/vercel/ai | direct |
| @antfu/install-pkg | 2.1.0 | MIT | https://github.com/antfu-collective/install-pkg | transitive |
| @babel/runtime | 7.29.15 | MIT | https://github.com/babel/babel | transitive |
| @braintree/sanitize-url | 7.1.2 | MIT | https://github.com/braintree/sanitize-url | transitive |
| @chevrotain/cst-dts-gen | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @chevrotain/gast | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @chevrotain/regexp-to-ast | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @chevrotain/types | 11.1.2 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @chevrotain/types | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @chevrotain/utils | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| @dimforge/rapier3d-compat | 0.12.0 | Apache-2.0 | https://github.com/dimforge/rapier.js | transitive |
| @emnapi/runtime | 1.11.3 | MIT | https://github.com/toyobayashi/emnapi | transitive |
| @floating-ui/core | 1.8.0 | MIT | https://github.com/floating-ui/floating-ui | transitive |
| @floating-ui/dom | 1.8.0 | MIT | https://github.com/floating-ui/floating-ui | transitive |
| @floating-ui/react-dom | 2.1.9 | MIT | https://github.com/floating-ui/floating-ui | transitive |
| @floating-ui/utils | 0.2.12 | MIT | https://github.com/floating-ui/floating-ui | transitive |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files | direct |
| @fontsource-variable/jetbrains-mono | 5.3.0 | OFL-1.1 | https://github.com/fontsource/font-files | direct |
| @iconify/types | 2.0.0 | MIT | https://github.com/iconify/iconify | transitive |
| @iconify/utils | 3.1.7 | MIT | https://github.com/iconify/iconify | transitive |
| @img/colour | 1.1.0 | MIT | https://github.com/lovell/colour | transitive |
| @img/sharp-darwin-arm64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-darwin-arm64 | transitive, platform build |
| @img/sharp-darwin-x64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-darwin-x64 | transitive, platform build |
| @img/sharp-freebsd-wasm32 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-freebsd-wasm32 | transitive, platform build |
| @img/sharp-libvips-darwin-arm64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-darwin-arm64 | transitive, platform build |
| @img/sharp-libvips-darwin-x64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-darwin-x64 | transitive, platform build |
| @img/sharp-libvips-linux-arm | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-arm | transitive, platform build |
| @img/sharp-libvips-linux-arm64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-arm64 | transitive, platform build |
| @img/sharp-libvips-linux-ppc64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-ppc64 | transitive, platform build |
| @img/sharp-libvips-linux-riscv64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-riscv64 | transitive, platform build |
| @img/sharp-libvips-linux-s390x | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-s390x | transitive, platform build |
| @img/sharp-libvips-linux-x64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linux-x64 | transitive, platform build |
| @img/sharp-libvips-linuxmusl-arm64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linuxmusl-arm64 | transitive, platform build |
| @img/sharp-libvips-linuxmusl-x64 | 1.3.4 | LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-libvips-linuxmusl-x64 | transitive, platform build |
| @img/sharp-linux-arm | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-arm | transitive, platform build |
| @img/sharp-linux-arm64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-arm64 | transitive, platform build |
| @img/sharp-linux-ppc64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-ppc64 | transitive, platform build |
| @img/sharp-linux-riscv64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-riscv64 | transitive, platform build |
| @img/sharp-linux-s390x | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-s390x | transitive, platform build |
| @img/sharp-linux-x64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linux-x64 | transitive, platform build |
| @img/sharp-linuxmusl-arm64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linuxmusl-arm64 | transitive, platform build |
| @img/sharp-linuxmusl-x64 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-linuxmusl-x64 | transitive, platform build |
| @img/sharp-wasm32 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later AND MIT | https://github.com/lovell/sharp | transitive |
| @img/sharp-webcontainers-wasm32 | 0.35.5 | Apache-2.0 | https://www.npmjs.com/package/@img/sharp-webcontainers-wasm32 | transitive, platform build |
| @img/sharp-win32-arm64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-win32-arm64 | transitive, platform build |
| @img/sharp-win32-ia32 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-win32-ia32 | transitive, platform build |
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later | https://www.npmjs.com/package/@img/sharp-win32-x64 | transitive, platform build |
| @mediapipe/tasks-vision | 0.10.17 | Apache-2.0 | https://www.npmjs.com/package/@mediapipe/tasks-vision | transitive |
| @mermaid-js/parser | 1.2.1 | MIT | https://github.com/mermaid-js/mermaid | transitive |
| @mermaid-js/parser | 2.0.1 | MIT | https://github.com/mermaid-js/mermaid | transitive |
| @monogrid/gainmap-js | 3.7.3 | MIT | https://github.com/MONOGRID/gainmap-js | transitive |
| @next/env | 16.4.6 | MIT | https://github.com/vercel/next.js | transitive |
| @next/swc-darwin-arm64 | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-darwin-arm64 | transitive, platform build |
| @next/swc-darwin-x64 | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-darwin-x64 | transitive, platform build |
| @next/swc-linux-arm64-gnu | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-linux-arm64-gnu | transitive, platform build |
| @next/swc-linux-arm64-musl | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-linux-arm64-musl | transitive, platform build |
| @next/swc-linux-x64-gnu | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-linux-x64-gnu | transitive, platform build |
| @next/swc-linux-x64-musl | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-linux-x64-musl | transitive, platform build |
| @next/swc-win32-arm64-msvc | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-win32-arm64-msvc | transitive, platform build |
| @next/swc-win32-x64-msvc | 16.4.6 | MIT | https://www.npmjs.com/package/@next/swc-win32-x64-msvc | transitive, platform build |
| @radix-ui/number | 1.1.3 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/primitive | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-accessible-icon | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-accordion | 1.3.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-alert-dialog | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-arrow | 1.1.17 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-aspect-ratio | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-avatar | 1.3.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-checkbox | 1.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-collapsible | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-collection | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-compose-refs | 1.1.5 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-context | 1.3.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-context-menu | 2.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-dialog | 1.3.1 | MIT | https://github.com/radix-ui/primitives | direct |
| @radix-ui/react-direction | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-dismissable-layer | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-dropdown-menu | 2.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-focus-guards | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-focus-scope | 1.3.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-form | 0.3.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-hover-card | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-id | 1.1.4 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-label | 2.1.17 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-menu | 2.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-menubar | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-navigation-menu | 1.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-one-time-password-field | 0.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-password-toggle-field | 0.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-popover | 1.3.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-popper | 1.4.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-portal | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-presence | 1.1.11 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-primitive | 2.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-progress | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-radio-group | 1.5.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-roving-focus | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-scroll-area | 1.4.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-select | 2.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-separator | 1.2.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-slider | 1.6.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-slot | 1.5.0 | MIT | https://github.com/radix-ui/primitives | direct |
| @radix-ui/react-switch | 1.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-tabs | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-toast | 1.3.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-toggle | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-toggle-group | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-toolbar | 1.2.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-tooltip | 1.4.1 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-callback-ref | 1.1.5 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-controllable-state | 1.3.0 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-effect-event | 0.0.5 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-escape-keydown | 1.1.6 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-is-hydrated | 0.1.3 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-layout-effect | 1.1.4 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-previous | 1.1.4 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-rect | 1.1.4 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-use-size | 1.1.5 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/react-visually-hidden | 1.2.13 | MIT | https://github.com/radix-ui/primitives | transitive |
| @radix-ui/rect | 1.1.3 | MIT | https://github.com/radix-ui/primitives | transitive |
| @react-three/drei | 10.7.9 | MIT | https://github.com/pmndrs/drei | direct |
| @react-three/fiber | 9.8.2 | MIT | https://github.com/pmndrs/react-three-fiber | direct |
| @shikijs/core | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/engine-javascript | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/engine-oniguruma | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/langs | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/primitive | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/themes | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/types | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| @shikijs/vscode-textmate | 10.1.0 | MIT | https://github.com/shikijs/vscode-textmate | transitive |
| @standard-schema/spec | 1.1.0 | MIT | https://github.com/standard-schema/standard-schema | transitive |
| @streamdown/cjk | 1.0.5 | Apache-2.0 | https://github.com/vercel/streamdown | direct |
| @streamdown/code | 2.0.1 | Apache-2.0 | https://github.com/vercel/streamdown | direct |
| @streamdown/math | 1.0.4 | Apache-2.0 | https://github.com/vercel/streamdown | direct |
| @streamdown/mermaid | 1.0.4 | Apache-2.0 | https://github.com/vercel/streamdown | direct |
| @swc/helpers | 0.5.23 | Apache-2.0 | https://github.com/swc-project/swc | transitive |
| @tanstack/query-core | 5.108.2 | MIT | https://github.com/TanStack/query | transitive |
| @tanstack/react-query | 5.108.2 | MIT | https://github.com/TanStack/query | direct |
| @tweenjs/tween.js | 23.1.3 | MIT | https://github.com/tweenjs/tween.js | transitive |
| @types/d3 | 7.4.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-array | 3.2.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-axis | 3.0.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-brush | 3.0.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-chord | 3.0.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-color | 3.1.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-contour | 3.0.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-delaunay | 6.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-dispatch | 3.0.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-drag | 3.0.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-dsv | 3.0.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-ease | 3.0.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-fetch | 3.0.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-force | 3.0.10 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-format | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-geo | 3.1.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-hierarchy | 3.1.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-interpolate | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-path | 3.1.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-polygon | 3.0.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-quadtree | 3.0.6 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-random | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-scale | 4.0.9 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-scale-chromatic | 3.1.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-selection | 3.0.12 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-shape | 3.2.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-time | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-time-format | 4.0.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-timer | 3.0.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-transition | 3.0.9 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/d3-zoom | 3.0.9 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/debug | 4.1.13 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/draco3d | 1.4.10 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/estree | 1.0.10 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/estree-jsx | 1.0.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/geojson | 7946.0.16 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/hast | 3.0.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/katex | 0.16.8 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/mdast | 4.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/ms | 2.1.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/node | 22.20.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/offscreencanvas | 2019.7.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/pg | 8.23.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/react | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/react-dom | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/react-reconciler | 0.28.9 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/stats.js | 0.17.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/three | 0.187.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/trusted-types | 2.0.7 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/unist | 2.0.11 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/unist | 3.0.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @types/webxr | 0.5.24 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped | transitive |
| @ungap/structured-clone | 1.4.0 | ISC | https://github.com/ungap/structured-clone | transitive |
| @upsetjs/venn.js | 2.0.0 | MIT | https://github.com/upsetjs/venn.js | transitive |
| @use-gesture/core | 10.3.1 | MIT | https://github.com/pmndrs/use-gesture | transitive |
| @use-gesture/react | 10.3.1 | MIT | https://github.com/pmndrs/use-gesture | transitive |
| @vercel/oidc | 3.2.0 | Apache-2.0 | https://github.com/vercel/vercel | transitive |
| @workflow/serde | 4.1.0 | Apache-2.0 | https://github.com/vercel/workflow | transitive |
| @xyflow/react | 13.0.2 | MIT | https://github.com/xyflow/xyflow | direct |
| @xyflow/system | 1.0.0 | MIT | https://github.com/xyflow/xyflow | transitive |
| ai | 7.0.179 | Apache-2.0 | https://github.com/vercel/ai | direct |
| ansi-regex | 6.6.0 | MIT | https://github.com/chalk/ansi-regex | transitive |
| ansi-styles | 6.2.3 | MIT | https://github.com/chalk/ansi-styles | transitive |
| aria-hidden | 1.2.6 | MIT | https://github.com/theKashey/aria-hidden | transitive |
| bail | 2.0.2 | MIT | https://github.com/wooorm/bail | transitive |
| balanced-match | 4.0.4 | MIT | https://github.com/juliangruber/balanced-match | transitive |
| base64-js | 1.5.1 | MIT | https://github.com/beatgammit/base64-js | transitive |
| baseline-browser-mapping | 2.11.39 | Apache-2.0 | https://github.com/web-platform-dx/baseline-browser-mapping | transitive |
| bidi-js | 1.1.0 | MIT | https://github.com/lojjic/bidi-js | transitive |
| brace-expansion | 5.0.13 | MIT | https://github.com/juliangruber/brace-expansion | transitive |
| buffer | 6.0.3 | MIT | https://github.com/feross/buffer | transitive |
| camera-controls | 3.1.2 | MIT | https://github.com/yomotsu/camera-controls | transitive |
| caniuse-lite | 1.0.30001826 | CC-BY-4.0 | https://github.com/browserslist/caniuse-lite | transitive |
| ccount | 2.0.1 | MIT | https://github.com/wooorm/ccount | transitive |
| character-entities | 2.0.2 | MIT | https://github.com/wooorm/character-entities | transitive |
| character-entities-html4 | 2.1.0 | MIT | https://github.com/wooorm/character-entities-html4 | transitive |
| character-entities-legacy | 3.0.0 | MIT | https://github.com/wooorm/character-entities-legacy | transitive |
| character-reference-invalid | 2.0.1 | MIT | https://github.com/wooorm/character-reference-invalid | transitive |
| chevrotain | 13.2.0 | Apache-2.0 | https://github.com/Chevrotain/chevrotain | transitive |
| class-variance-authority | 0.7.1 | Apache-2.0 | https://github.com/joe-bell/cva | direct |
| classcat | 5.0.5 | MIT | https://github.com/jorgebucaran/classcat | transitive |
| client-only | 0.0.1 | MIT | https://www.npmjs.com/package/client-only | transitive |
| cliui | 9.0.1 | ISC | https://github.com/yargs/cliui | transitive |
| clsx | 2.1.1 | MIT | https://github.com/lukeed/clsx | direct |
| cmdk | 1.1.1 | MIT | https://github.com/pacocoursey/cmdk | direct |
| cn | 0.5.2 | MIT | https://github.com/shadcn-ui/cn | direct |
| comma-separated-tokens | 2.0.3 | MIT | https://github.com/wooorm/comma-separated-tokens | transitive |
| commander | 15.1.0 | MIT | https://github.com/tj/commander.js | transitive |
| commander | 7.2.0 | MIT | https://github.com/tj/commander.js | transitive |
| commander | 8.3.0 | MIT | https://github.com/tj/commander.js | transitive |
| cose-base | 1.0.3 | MIT | https://github.com/iVis-at-Bilkent/cose-base | transitive |
| cose-base | 2.2.0 | MIT | https://github.com/iVis-at-Bilkent/cose-base | transitive |
| cross-env | 7.0.3 | MIT | https://github.com/kentcdodds/cross-env | transitive |
| cross-spawn | 7.0.6 | MIT | https://github.com/moxystudio/node-cross-spawn | transitive |
| csstype | 3.2.4 | MIT | https://github.com/frenic/csstype | transitive |
| cytoscape | 3.35.0 | MIT | https://github.com/cytoscape/cytoscape.js | transitive |
| cytoscape-cose-bilkent | 4.1.0 | MIT | https://github.com/cytoscape/cytoscape.js-cose-bilkent | transitive |
| cytoscape-fcose | 2.2.0 | MIT | https://github.com/iVis-at-Bilkent/cytoscape.js-fcose | transitive |
| d3 | 7.9.2 | ISC | https://github.com/d3/d3 | transitive |
| d3-array | 2.12.1 | BSD-3-Clause | https://github.com/d3/d3-array | transitive |
| d3-array | 3.2.5 | ISC | https://github.com/d3/d3-array | transitive |
| d3-axis | 3.0.1 | ISC | https://github.com/d3/d3-axis | transitive |
| d3-brush | 3.0.1 | ISC | https://github.com/d3/d3-brush | transitive |
| d3-chord | 3.0.2 | ISC | https://github.com/d3/d3-chord | transitive |
| d3-color | 3.1.1 | ISC | https://github.com/d3/d3-color | transitive |
| d3-contour | 4.0.3 | ISC | https://github.com/d3/d3-contour | transitive |
| d3-delaunay | 6.0.6 | ISC | https://github.com/d3/d3-delaunay | transitive |
| d3-dispatch | 3.0.2 | ISC | https://github.com/d3/d3-dispatch | transitive |
| d3-drag | 3.0.1 | ISC | https://github.com/d3/d3-drag | transitive |
| d3-dsv | 3.0.2 | ISC | https://github.com/d3/d3-dsv | transitive |
| d3-ease | 3.0.2 | BSD-3-Clause | https://github.com/d3/d3-ease | transitive |
| d3-fetch | 3.0.2 | ISC | https://github.com/d3/d3-fetch | transitive |
| d3-force | 3.0.1 | ISC | https://github.com/d3/d3-force | transitive |
| d3-format | 3.1.3 | ISC | https://github.com/d3/d3-format | transitive |
| d3-geo | 3.1.2 | ISC | https://github.com/d3/d3-geo | transitive |
| d3-hierarchy | 3.1.3 | ISC | https://github.com/d3/d3-hierarchy | transitive |
| d3-interpolate | 3.0.2 | ISC | https://github.com/d3/d3-interpolate | transitive |
| d3-path | 1.0.9 | BSD-3-Clause | https://github.com/d3/d3-path | transitive |
| d3-path | 3.1.1 | ISC | https://github.com/d3/d3-path | transitive |
| d3-polygon | 3.0.2 | ISC | https://github.com/d3/d3-polygon | transitive |
| d3-quadtree | 3.0.2 | ISC | https://github.com/d3/d3-quadtree | transitive |
| d3-random | 3.0.2 | ISC | https://github.com/d3/d3-random | transitive |
| d3-sankey | 0.12.3 | BSD-3-Clause | https://github.com/d3/d3-sankey | transitive |
| d3-scale | 4.0.3 | ISC | https://github.com/d3/d3-scale | transitive |
| d3-scale-chromatic | 3.1.1 | ISC | https://github.com/d3/d3-scale-chromatic | transitive |
| d3-selection | 3.0.1 | ISC | https://github.com/d3/d3-selection | transitive |
| d3-shape | 1.3.7 | BSD-3-Clause | https://github.com/d3/d3-shape | transitive |
| d3-shape | 3.2.1 | ISC | https://github.com/d3/d3-shape | transitive |
| d3-time | 3.1.1 | ISC | https://github.com/d3/d3-time | transitive |
| d3-time-format | 4.1.1 | ISC | https://github.com/d3/d3-time-format | transitive |
| d3-timer | 3.0.2 | ISC | https://github.com/d3/d3-timer | transitive |
| d3-transition | 3.0.2 | ISC | https://github.com/d3/d3-transition | transitive |
| d3-zoom | 3.0.1 | ISC | https://github.com/d3/d3-zoom | transitive |
| dagre-d3-es | 7.0.14 | MIT | https://github.com/tbo47/dagre-es | transitive |
| dayjs | 1.11.23 | MIT | https://github.com/iamkun/dayjs | transitive |
| debug | 4.4.3 | MIT | https://github.com/debug-js/debug | transitive |
| decode-named-character-reference | 1.3.0 | MIT | https://github.com/wooorm/decode-named-character-reference | transitive |
| delaunator | 5.1.0 | ISC | https://github.com/mapbox/delaunator | transitive |
| dequal | 2.0.3 | MIT | https://github.com/lukeed/dequal | transitive |
| detect-gpu | 5.0.70 | MIT | https://github.com/pmndrs/detect-gpu | transitive |
| detect-libc | 2.1.2 | Apache-2.0 | https://github.com/lovell/detect-libc | transitive |
| detect-node-es | 1.1.0 | MIT | https://github.com/thekashey/detect-node | transitive |
| devlop | 1.1.0 | MIT | https://github.com/wooorm/devlop | transitive |
| dompurify | 3.4.18 | (MPL-2.0 OR Apache-2.0) | https://github.com/cure53/DOMPurify | transitive |
| draco3d | 1.5.9 | Apache-2.0 | https://github.com/google/draco | transitive |
| elkjs | 0.12.1 | EPL-2.0 OR GPL-3.0-or-later | https://github.com/kieler/elkjs | transitive |
| embla-carousel | 8.6.0 | MIT | https://github.com/davidjerleke/embla-carousel | transitive |
| embla-carousel-react | 8.6.0 | MIT | https://github.com/davidjerleke/embla-carousel | direct |
| embla-carousel-reactive-utils | 8.6.0 | MIT | https://github.com/davidjerleke/embla-carousel | transitive |
| emoji-regex | 10.6.0 | MIT | https://github.com/mathiasbynens/emoji-regex | transitive |
| entities | 9.0.0 | BSD-2-Clause | https://github.com/fb55/entities | transitive |
| es-toolkit | 1.53.2 | MIT | https://github.com/toss/es-toolkit | transitive |
| escalade | 3.2.0 | MIT | https://github.com/lukeed/escalade | transitive |
| escape-string-regexp | 5.0.0 | MIT | https://github.com/sindresorhus/escape-string-regexp | transitive |
| estree-util-is-identifier-name | 3.0.0 | MIT | https://github.com/syntax-tree/estree-util-is-identifier-name | transitive |
| eventsource-parser | 3.1.1 | MIT | https://github.com/rexxars/eventsource-parser | transitive |
| extend | 3.0.2 | MIT | https://github.com/justmoon/node-extend | transitive |
| fastdom | 1.0.12 | MIT | https://github.com/wilsonpage/fastdom | transitive |
| fflate | 0.6.11 | MIT | https://github.com/101arrowz/fflate | transitive |
| fflate | 0.8.3 | MIT | https://github.com/101arrowz/fflate | transitive |
| framer-motion | 14.14.0 | MIT | https://github.com/motiondivision/motion | direct |
| get-caller-file | 2.0.5 | ISC | https://github.com/stefanpenner/get-caller-file | transitive |
| get-east-asian-width | 1.7.0 | MIT | https://github.com/sindresorhus/get-east-asian-width | transitive |
| get-nonce | 1.0.1 | MIT | https://github.com/theKashey/get-nonce | transitive |
| glob | 13.0.7 | BlueOak-1.0.0 | https://github.com/isaacs/node-glob | transitive |
| glsl-noise | 0.0.0 | MIT | https://github.com/hughsk/glsl-noise | transitive |
| hachure-fill | 0.5.2 | MIT | https://github.com/pshihn/hachure-fill | transitive |
| hast-util-from-dom | 5.0.1 | ISC | https://github.com/syntax-tree/hast-util-from-dom | transitive |
| hast-util-from-html | 2.1.0 | MIT | https://github.com/syntax-tree/hast-util-from-html | transitive |
| hast-util-from-html-isomorphic | 2.0.0 | MIT | https://github.com/syntax-tree/hast-util-from-html-isomorphic | transitive |
| hast-util-from-parse5 | 8.0.4 | MIT | https://github.com/syntax-tree/hast-util-from-parse5 | transitive |
| hast-util-parse-selector | 4.0.0 | MIT | https://github.com/syntax-tree/hast-util-parse-selector | transitive |
| hast-util-raw | 9.2.1 | MIT | https://github.com/syntax-tree/hast-util-raw | transitive |
| hast-util-sanitize | 5.0.2 | MIT | https://github.com/syntax-tree/hast-util-sanitize | transitive |
| hast-util-to-html | 9.0.7 | MIT | https://github.com/syntax-tree/hast-util-to-html | transitive |
| hast-util-to-jsx-runtime | 2.3.7 | MIT | https://github.com/syntax-tree/hast-util-to-jsx-runtime | transitive |
| hast-util-to-parse5 | 8.0.1 | MIT | https://github.com/syntax-tree/hast-util-to-parse5 | transitive |
| hast-util-to-text | 4.0.5 | MIT | https://github.com/syntax-tree/hast-util-to-text | transitive |
| hast-util-whitespace | 3.0.0 | MIT | https://github.com/syntax-tree/hast-util-whitespace | transitive |
| hastscript | 9.0.3 | MIT | https://github.com/syntax-tree/hastscript | transitive |
| hls.js | 1.7.4 | Apache-2.0 | https://github.com/video-dev/hls.js | transitive |
| html-url-attributes | 3.0.1 | MIT | https://github.com/rehypejs/rehype-minify.git#main | transitive |
| html-void-elements | 3.0.0 | MIT | https://github.com/wooorm/html-void-elements | transitive |
| iconv-lite | 0.6.3 | MIT | https://github.com/ashtuchkin/iconv-lite | transitive |
| ieee754 | 1.2.1 | BSD-3-Clause | https://github.com/feross/ieee754 | transitive |
| immediate | 3.0.6 | MIT | https://github.com/calvinmetcalf/immediate | transitive |
| import-meta-resolve | 4.2.0 | MIT | https://github.com/wooorm/import-meta-resolve | transitive |
| inline-style-parser | 0.2.9 | MIT | https://github.com/remarkablemark/inline-style-parser | transitive |
| internmap | 1.0.1 | ISC | https://github.com/mbostock/internmap | transitive |
| internmap | 2.0.3 | ISC | https://github.com/mbostock/internmap | transitive |
| is-alphabetical | 2.0.1 | MIT | https://github.com/wooorm/is-alphabetical | transitive |
| is-alphanumerical | 2.0.1 | MIT | https://github.com/wooorm/is-alphanumerical | transitive |
| is-decimal | 2.0.1 | MIT | https://github.com/wooorm/is-decimal | transitive |
| is-hexadecimal | 2.0.1 | MIT | https://github.com/wooorm/is-hexadecimal | transitive |
| is-plain-obj | 4.1.0 | MIT | https://github.com/sindresorhus/is-plain-obj | transitive |
| is-promise | 2.2.2 | MIT | https://github.com/then/is-promise | transitive |
| isexe | 2.0.0 | ISC | https://github.com/isaacs/isexe | transitive |
| its-fine | 2.1.1 | MIT | https://github.com/pmndrs/its-fine | transitive |
| jiti | 2.7.0 | MIT | https://github.com/unjs/jiti | transitive |
| json-schema | 0.4.0 | (AFL-2.1 OR BSD-3-Clause) | https://github.com/kriszyp/json-schema | transitive |
| katex | 0.16.47 | MIT | https://github.com/KaTeX/KaTeX | transitive |
| katex | 0.18.10 | MIT | https://github.com/KaTeX/KaTeX | transitive |
| khroma | 2.1.0 | MIT (from its licence file; package.json declares none) | https://github.com/fabiospampinato/khroma | transitive |
| layout-base | 1.0.2 | MIT | https://github.com/iVis-at-Bilkent/layout-base | transitive |
| layout-base | 2.0.1 | MIT | https://github.com/iVis-at-Bilkent/layout-base | transitive |
| lie | 3.3.0 | MIT | https://github.com/calvinmetcalf/lie | transitive |
| lodash-es | 4.18.1 | MIT | https://github.com/lodash/lodash | transitive |
| longest-streak | 3.1.0 | MIT | https://github.com/wooorm/longest-streak | transitive |
| lru-cache | 11.5.3 | BlueOak-1.0.0 | https://github.com/isaacs/node-lru-cache | transitive |
| lucide-react | 1.77.0 | ISC | https://github.com/lucide-icons/lucide | direct |
| maath | 0.10.8 | MIT | https://www.npmjs.com/package/maath | transitive |
| markdown-table | 3.1.0 | MIT | https://github.com/wooorm/markdown-table | transitive |
| marked | 16.4.2 | MIT | https://github.com/markedjs/marked | transitive |
| marked | 18.2.1 | MIT | https://github.com/markedjs/marked | transitive |
| mdast-util-find-and-replace | 3.0.5 | MIT | https://github.com/syntax-tree/mdast-util-find-and-replace | transitive |
| mdast-util-from-markdown | 2.1.0 | MIT | https://github.com/syntax-tree/mdast-util-from-markdown | transitive |
| mdast-util-gfm | 3.1.0 | MIT | https://github.com/syntax-tree/mdast-util-gfm | transitive |
| mdast-util-gfm-autolink-literal | 2.1.2 | MIT | https://github.com/syntax-tree/mdast-util-gfm-autolink-literal | transitive |
| mdast-util-gfm-footnote | 2.1.0 | MIT | https://github.com/syntax-tree/mdast-util-gfm-footnote | transitive |
| mdast-util-gfm-strikethrough | 2.0.1 | MIT | https://github.com/syntax-tree/mdast-util-gfm-strikethrough | transitive |
| mdast-util-gfm-table | 2.0.1 | MIT | https://github.com/syntax-tree/mdast-util-gfm-table | transitive |
| mdast-util-gfm-task-list-item | 2.0.1 | MIT | https://github.com/syntax-tree/mdast-util-gfm-task-list-item | transitive |
| mdast-util-math | 3.0.0 | MIT | https://github.com/syntax-tree/mdast-util-math | transitive |
| mdast-util-mdx-expression | 2.0.1 | MIT | https://github.com/syntax-tree/mdast-util-mdx-expression | transitive |
| mdast-util-mdx-jsx | 3.2.2 | MIT | https://github.com/syntax-tree/mdast-util-mdx-jsx | transitive |
| mdast-util-mdxjs-esm | 2.0.1 | MIT | https://github.com/syntax-tree/mdast-util-mdxjs-esm | transitive |
| mdast-util-phrasing | 4.1.0 | MIT | https://github.com/syntax-tree/mdast-util-phrasing | transitive |
| mdast-util-to-hast | 13.2.2 | MIT | https://github.com/syntax-tree/mdast-util-to-hast | transitive |
| mdast-util-to-markdown | 2.2.4 | MIT | https://github.com/syntax-tree/mdast-util-to-markdown | transitive |
| mdast-util-to-markdown-cjk-friendly | 1.0.2 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| mdast-util-to-markdown-cjk-friendly-gfm-strikethrough | 1.0.2 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| mdast-util-to-string | 4.0.0 | MIT | https://github.com/syntax-tree/mdast-util-to-string | transitive |
| mermaid | 11.17.2 | MIT | https://github.com/mermaid-js/mermaid | transitive |
| mermaid | 12.3.0 | MIT | https://github.com/mermaid-js/mermaid | direct |
| meshline | 3.3.1 | MIT | https://www.npmjs.com/package/meshline | transitive |
| meshoptimizer | 1.1.1 | MIT | https://github.com/zeux/meshoptimizer | transitive |
| micromark | 4.0.3 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-core-commonmark | 2.0.4 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-extension-cjk-friendly | 2.0.2 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| micromark-extension-cjk-friendly-gfm-strikethrough | 2.0.1 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| micromark-extension-cjk-friendly-util | 3.0.1 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| micromark-extension-gfm | 3.0.0 | MIT | https://github.com/micromark/micromark-extension-gfm | transitive |
| micromark-extension-gfm-autolink-literal | 2.1.0 | MIT | https://github.com/micromark/micromark-extension-gfm-autolink-literal | transitive |
| micromark-extension-gfm-footnote | 2.1.0 | MIT | https://github.com/micromark/micromark-extension-gfm-footnote | transitive |
| micromark-extension-gfm-strikethrough | 2.1.0 | MIT | https://github.com/micromark/micromark-extension-gfm-strikethrough | transitive |
| micromark-extension-gfm-table | 2.1.2 | MIT | https://github.com/micromark/micromark-extension-gfm-table | transitive |
| micromark-extension-gfm-tagfilter | 2.0.0 | MIT | https://github.com/micromark/micromark-extension-gfm-tagfilter | transitive |
| micromark-extension-gfm-task-list-item | 2.1.0 | MIT | https://github.com/micromark/micromark-extension-gfm-task-list-item | transitive |
| micromark-extension-math | 3.1.0 | MIT | https://github.com/micromark/micromark-extension-math | transitive |
| micromark-factory-destination | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-factory-label | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-factory-space | 2.1.0 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-factory-title | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-factory-whitespace | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-character | 2.1.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-chunked | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-classify-character | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-combine-extensions | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-decode-numeric-character-reference | 2.0.2 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-decode-string | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-edit-map | 1.0.0 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-encode | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-html-tag-name | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-normalize-identifier | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-resolve-all | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-sanitize-uri | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-subtokenize | 2.1.0 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-symbol | 2.0.1 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| micromark-util-types | 2.0.3 | MIT | https://github.com/micromark/micromark.git#main | transitive |
| minimatch | 10.2.6 | BlueOak-1.0.0 | https://github.com/isaacs/minimatch | transitive |
| minipass | 7.1.3 | BlueOak-1.0.0 | https://github.com/isaacs/minipass | transitive |
| motion | 14.14.0 | MIT | https://github.com/motiondivision/motion | direct |
| motion-dom | 14.14.0 | MIT | https://github.com/motiondivision/motion | transitive |
| motion-utils | 14.7.0 | MIT | https://github.com/motiondivision/motion | transitive |
| ms | 2.1.3 | MIT | https://github.com/vercel/ms | transitive |
| nanoid | 3.3.20 | MIT | https://github.com/ai/nanoid | transitive |
| nanoid | 6.0.2 | MIT | https://github.com/ai/nanoid | direct |
| next | 16.4.6 | MIT | https://github.com/vercel/next.js | direct |
| next-themes | 0.4.6 | MIT | https://github.com/pacocoursey/next-themes | direct |
| node-pg-migrate | 9.0.0 | MIT | https://github.com/salsita/node-pg-migrate | direct |
| oniguruma-parser | 0.12.2 | MIT | https://github.com/slevithan/oniguruma-parser | transitive |
| oniguruma-to-es | 4.3.6 | MIT | https://github.com/slevithan/oniguruma-to-es | transitive |
| package-manager-detector | 1.9.0 | MIT | https://github.com/antfu-collective/package-manager-detector | transitive |
| parse-entities | 4.0.2 | MIT | https://github.com/wooorm/parse-entities | transitive |
| parse5 | 8.1.1 | MIT | https://github.com/inikulin/parse5 | transitive |
| path-data-parser | 0.1.0 | MIT | https://github.com/pshihn/path-data-parser | transitive |
| path-key | 3.1.1 | MIT | https://github.com/sindresorhus/path-key | transitive |
| path-scurry | 2.0.2 | BlueOak-1.0.0 | https://github.com/isaacs/path-scurry | transitive |
| pg | 8.23.1 | MIT | https://github.com/brianc/node-postgres | direct |
| pg-cloudflare | 1.4.1 | MIT | https://github.com/brianc/node-postgres | transitive |
| pg-connection-string | 2.14.1 | MIT | https://github.com/brianc/node-postgres | transitive |
| pg-int8 | 1.0.1 | ISC | https://github.com/charmander/pg-int8 | transitive |
| pg-pool | 3.14.0 | MIT | https://github.com/brianc/node-postgres | transitive |
| pg-protocol | 1.16.1 | MIT | https://github.com/brianc/node-postgres | transitive |
| pg-types | 2.2.0 | MIT | https://github.com/brianc/node-pg-types | transitive |
| pgpass | 1.0.5 | MIT | https://github.com/hoegaarden/pgpass | transitive |
| picocolors | 1.1.1 | ISC | https://github.com/alexeyraspopov/picocolors | transitive |
| pkce-challenge | 5.0.1 | MIT | https://github.com/crouchcd/pkce-challenge | transitive |
| points-on-curve | 0.2.0 | MIT | https://github.com/pshihn/bezier-points | transitive |
| points-on-path | 0.2.1 | MIT | https://github.com/pshihn/points-on-path | transitive |
| postcss | 8.5.23 | MIT | https://github.com/postcss/postcss | transitive |
| postgres-array | 2.0.0 | MIT | https://github.com/bendrucker/postgres-array | transitive |
| postgres-bytea | 1.0.1 | MIT | https://github.com/bendrucker/postgres-bytea | transitive |
| postgres-date | 1.0.7 | MIT | https://github.com/bendrucker/postgres-date | transitive |
| postgres-interval | 1.2.0 | MIT | https://github.com/bendrucker/postgres-interval | transitive |
| potpack | 1.0.2 | ISC | https://github.com/mapbox/potpack | transitive |
| promise-worker-transferable | 1.0.4 | Apache-2.0 | https://github.com/terikon/promise-worker-transferable | transitive |
| property-information | 7.2.0 | MIT | https://github.com/wooorm/property-information | transitive |
| radix-ui | 1.8.1 | MIT | https://github.com/radix-ui/primitives | direct |
| react | 19.3.0 | MIT | https://github.com/react/react | direct |
| react-compiler-runtime | 1.0.0 | MIT | https://github.com/facebook/react | transitive |
| react-dom | 19.3.0 | MIT | https://github.com/react/react | direct |
| react-markdown | 10.1.0 | MIT | https://github.com/remarkjs/react-markdown | direct |
| react-remove-scroll | 2.7.2 | MIT | https://github.com/theKashey/react-remove-scroll | transitive |
| react-remove-scroll-bar | 2.3.8 | MIT | https://github.com/theKashey/react-remove-scroll-bar | transitive |
| react-style-singleton | 2.2.3 | MIT | https://github.com/theKashey/react-style-singleton | transitive |
| react-use-measure | 2.1.7 | MIT | https://github.com/pmndrs/react-use-measure | transitive |
| regex | 6.1.0 | MIT | https://github.com/slevithan/regex | transitive |
| regex-recursion | 6.0.2 | MIT | https://github.com/slevithan/regex-recursion | transitive |
| regex-utilities | 2.3.0 | MIT | https://github.com/slevithan/regex-utilities | transitive |
| rehype-harden | 1.1.9 | MIT | https://github.com/vercel-labs/markdown-sanitizers | transitive |
| rehype-katex | 7.0.1 | MIT | https://github.com/remarkjs/remark-math.git#main | transitive |
| rehype-raw | 7.0.0 | MIT | https://github.com/rehypejs/rehype-raw | transitive |
| rehype-sanitize | 6.0.0 | MIT | https://github.com/rehypejs/rehype-sanitize | transitive |
| remark-cjk-friendly | 2.3.4 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| remark-cjk-friendly-gfm-strikethrough | 2.3.3 | MIT | https://github.com/tats-u/markdown-cjk-friendly | transitive |
| remark-gfm | 4.0.1 | MIT | https://github.com/remarkjs/remark-gfm | direct |
| remark-math | 6.0.0 | MIT | https://github.com/remarkjs/remark-math.git#main | transitive |
| remark-parse | 11.0.0 | MIT | https://github.com/remarkjs/remark.git#main | transitive |
| remark-rehype | 11.1.2 | MIT | https://github.com/remarkjs/remark-rehype | transitive |
| remark-stringify | 11.0.0 | MIT | https://github.com/remarkjs/remark.git#main | transitive |
| remend | 1.5.0 | Apache-2.0 | https://github.com/vercel/streamdown | transitive |
| require-from-string | 2.0.2 | MIT | https://github.com/floatdrop/require-from-string | transitive |
| robust-predicates | 3.0.3 | Unlicense | https://github.com/mourner/robust-predicates | transitive |
| roughjs | 4.6.6 | MIT | https://github.com/pshihn/rough | transitive |
| rw | 1.3.3 | BSD-3-Clause | https://github.com/mbostock/rw | transitive |
| safer-buffer | 2.1.2 | MIT | https://github.com/ChALkeR/safer-buffer | transitive |
| scheduler | 0.28.0 | MIT | https://github.com/react/react | transitive |
| semver | 7.8.6 | ISC | https://github.com/npm/node-semver | transitive |
| sharp | 0.35.5 | Apache-2.0 | https://github.com/lovell/sharp | transitive |
| shebang-command | 2.0.0 | MIT | https://github.com/kevva/shebang-command | transitive |
| shebang-regex | 3.0.0 | MIT | https://github.com/sindresorhus/shebang-regex | transitive |
| shiki | 4.6.0 | MIT | https://github.com/shikijs/shiki | transitive |
| sonner | 2.0.8 | MIT | https://github.com/emilkowalski/sonner | direct |
| source-map-js | 1.2.4 | BSD-3-Clause | https://github.com/7rulnik/source-map-js | transitive |
| space-separated-tokens | 2.0.2 | MIT | https://github.com/wooorm/space-separated-tokens | transitive |
| split2 | 4.2.0 | ISC | https://github.com/mcollina/split2 | transitive |
| stats-gl | 2.4.2 | MIT | https://github.com/RenaudRohlinger/stats-gl | transitive |
| stats.js | 0.17.0 | MIT | https://github.com/mrdoob/stats.js | transitive |
| streamdown | 2.8.0 | Apache-2.0 | https://github.com/vercel/streamdown | direct |
| strictdom | 1.0.1 | MIT | https://github.com/wilsonpage/strictdom | transitive |
| string-width | 7.2.0 | MIT | https://github.com/sindresorhus/string-width | transitive |
| stringify-entities | 4.0.5 | MIT | https://github.com/wooorm/stringify-entities | transitive |
| strip-ansi | 7.2.0 | MIT | https://github.com/chalk/strip-ansi | transitive |
| style-to-object | 2.0.2 | MIT | https://github.com/remarkablemark/style-to-object | transitive |
| styled-jsx | 5.1.6 | MIT | https://github.com/vercel/styled-jsx | transitive |
| stylis | 4.4.0 | MIT | https://github.com/thysultan/stylis.js | transitive |
| suspend-react | 0.1.3 | MIT | https://github.com/pmndrs/suspend-react | transitive |
| swr | 2.5.1 | MIT | https://github.com/vercel/swr | transitive |
| tailwind-merge | 3.7.1 | MIT | https://github.com/dcastil/tailwind-merge | direct |
| three | 0.170.0 | MIT | https://github.com/mrdoob/three.js | transitive |
| three | 0.187.0 | MIT | https://github.com/mrdoob/three.js | direct |
| three-mesh-bvh | 0.8.3 | MIT | https://github.com/gkjohnson/three-mesh-bvh | transitive |
| three-stdlib | 2.36.1 | MIT | https://github.com/pmndrs/three-stdlib | transitive |
| throttleit | 2.1.0 | MIT | https://github.com/sindresorhus/throttleit | transitive |
| tinyexec | 1.3.1 | MIT | https://github.com/tinylibs/tinyexec | transitive |
| trim-lines | 3.0.1 | MIT | https://github.com/wooorm/trim-lines | transitive |
| troika-three-text | 0.52.5 | MIT | https://github.com/protectwise/troika | transitive |
| troika-three-utils | 0.52.5 | MIT | https://github.com/protectwise/troika | transitive |
| troika-worker-utils | 0.52.0 | MIT | https://github.com/protectwise/troika | transitive |
| trough | 2.2.0 | MIT | https://github.com/wooorm/trough | transitive |
| ts-dedent | 2.3.0 | MIT | https://github.com/tamino-martinius/node-ts-dedent | transitive |
| tslib | 2.9.1 | 0BSD | https://github.com/Microsoft/tslib | transitive |
| tunnel-rat | 0.1.2 | MIT | https://github.com/pmndrs/tunnel-rat | transitive |
| undici-types | 6.21.0 | MIT | https://github.com/nodejs/undici | transitive |
| unified | 11.0.5 | MIT | https://github.com/unifiedjs/unified | transitive |
| unist-util-is | 6.0.1 | MIT | https://github.com/syntax-tree/unist-util-is | transitive |
| unist-util-position | 5.0.0 | MIT | https://github.com/syntax-tree/unist-util-position | transitive |
| unist-util-remove-position | 5.0.0 | MIT | https://github.com/syntax-tree/unist-util-remove-position | transitive |
| unist-util-stringify-position | 4.0.0 | MIT | https://github.com/syntax-tree/unist-util-stringify-position | transitive |
| unist-util-visit | 5.2.0 | MIT | https://github.com/syntax-tree/unist-util-visit | transitive |
| unist-util-visit-parents | 6.1.0 | MIT | https://github.com/syntax-tree/unist-util-visit-parents | transitive |
| use-callback-ref | 1.3.3 | MIT | https://github.com/theKashey/use-callback-ref | transitive |
| use-sidecar | 1.1.3 | MIT | https://github.com/theKashey/use-sidecar | transitive |
| use-stick-to-bottom | 1.1.6 | MIT | https://github.com/samdenty/use-stick-to-bottom | direct |
| use-sync-external-store | 1.7.0 | MIT | https://github.com/react/react | transitive |
| utility-types | 3.11.0 | MIT | https://github.com/piotrwitek/utility-types | transitive |
| uuid | 14.0.3 | MIT | https://github.com/uuidjs/uuid | transitive |
| vfile | 6.0.3 | MIT | https://github.com/vfile/vfile | transitive |
| vfile-location | 5.0.4 | MIT | https://github.com/vfile/vfile-location | transitive |
| vfile-message | 4.0.4 | MIT | https://github.com/vfile/vfile-message | transitive |
| web-namespaces | 2.0.1 | MIT | https://github.com/wooorm/web-namespaces | transitive |
| webgl-constants | 1.1.1 | MIT (from its licence file; package.json declares none) | https://www.npmjs.com/package/webgl-constants | transitive |
| webgl-sdf-generator | 1.1.1 | MIT | https://github.com/lojjic/webgl-sdf-generator | transitive |
| which | 2.0.2 | ISC | https://github.com/isaacs/node-which | transitive |
| wrap-ansi | 9.0.2 | MIT | https://github.com/chalk/wrap-ansi | transitive |
| xtend | 4.0.2 | MIT | https://github.com/Raynos/xtend | transitive |
| y18n | 5.0.8 | ISC | https://github.com/yargs/y18n | transitive |
| yargs | 18.0.0 | MIT | https://github.com/yargs/yargs | transitive |
| yargs-parser | 22.0.0 | ISC | https://github.com/yargs/yargs-parser | transitive |
| zod | 4.6.7 | MIT | https://github.com/colinhacks/zod | direct |
| zustand | 4.5.7 | MIT | https://github.com/pmndrs/zustand | transitive |
| zustand | 5.1.0 | MIT | https://github.com/pmndrs/zustand | transitive |
| zwitch | 2.0.4 | MIT | https://github.com/wooorm/zwitch | transitive |

### Licence texts

Each licence identifier found above, with its text once, copied from the first package (in the order above) that ships it as a licence file and is installed on every platform. Copyright lines differ from package to package; each package's own licence file is in its published package.

#### 0BSD

Used by: tslib@2.9.1.

Text from tslib@2.9.1, LICENSE.txt:

```text
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

#### AFL-2.1

Used by: json-schema@0.4.0.

No package installed on every platform ships this licence's text in a licence file, so the text is not reproduced here. Reference text: https://spdx.org/licenses/AFL-2.1.html

#### Apache-2.0

Used by: @ai-sdk/gateway@4.0.152, @ai-sdk/mcp@2.0.102, @ai-sdk/openai-compatible@3.0.94, @ai-sdk/provider@4.0.39, @ai-sdk/provider-utils@5.0.83, @ai-sdk/react@4.0.183, @chevrotain/cst-dts-gen@13.2.0, @chevrotain/gast@13.2.0, @chevrotain/regexp-to-ast@13.2.0, @chevrotain/types@11.1.2, @chevrotain/types@13.2.0, @chevrotain/utils@13.2.0, @dimforge/rapier3d-compat@0.12.0, @img/sharp-darwin-arm64@0.35.5, @img/sharp-darwin-x64@0.35.5, @img/sharp-freebsd-wasm32@0.35.5, @img/sharp-linux-arm@0.35.5, @img/sharp-linux-arm64@0.35.5, @img/sharp-linux-ppc64@0.35.5, @img/sharp-linux-riscv64@0.35.5, @img/sharp-linux-s390x@0.35.5, @img/sharp-linux-x64@0.35.5, @img/sharp-linuxmusl-arm64@0.35.5, @img/sharp-linuxmusl-x64@0.35.5, @img/sharp-wasm32@0.35.5, @img/sharp-webcontainers-wasm32@0.35.5, @img/sharp-win32-arm64@0.35.5, @img/sharp-win32-ia32@0.35.5, @img/sharp-win32-x64@0.35.5, @mediapipe/tasks-vision@0.10.17, @streamdown/cjk@1.0.5, @streamdown/code@2.0.1, @streamdown/math@1.0.4, @streamdown/mermaid@1.0.4, @swc/helpers@0.5.23, @vercel/oidc@3.2.0, @workflow/serde@4.1.0, ai@7.0.179, baseline-browser-mapping@2.11.39, chevrotain@13.2.0, class-variance-authority@0.7.1, detect-libc@2.1.2, dompurify@3.4.18, draco3d@1.5.9, hls.js@1.7.4, promise-worker-transferable@1.0.4, remend@1.5.0, sharp@0.35.5, streamdown@2.8.0.

Text from @chevrotain/cst-dts-gen@13.2.0, LICENSE.txt:

```text

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

#### BSD-2-Clause

Used by: entities@9.0.0.

Text from entities@9.0.0, LICENSE:

```text
Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

#### BSD-3-Clause

Used by: d3-array@2.12.1, d3-ease@3.0.2, d3-path@1.0.9, d3-sankey@0.12.3, d3-shape@1.3.7, ieee754@1.2.1, json-schema@0.4.0, rw@1.3.3, source-map-js@1.2.4.

Text from d3-array@2.12.1, LICENSE:

```text
Copyright 2010-2020 Mike Bostock
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of the author nor the names of contributors may be used to
  endorse or promote products derived from this software without specific prior
  written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

#### BlueOak-1.0.0

Used by: glob@13.0.7, lru-cache@11.5.3, minimatch@10.2.6, minipass@7.1.3, path-scurry@2.0.2.

Text from glob@13.0.7, LICENSE.md:

```text
All packages under `src/` are licensed according to the terms in
their respective `LICENSE` or `LICENSE.md` files.

The remainder of this project is licensed under the Blue Oak
Model License, as follows:

-----

# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***
```

#### CC-BY-4.0

Used by: caniuse-lite@1.0.30001826.

Text from caniuse-lite@1.0.30001826, LICENSE:

```text
Attribution 4.0 International

=======================================================================

Creative Commons Corporation ("Creative Commons") is not a law firm and
does not provide legal services or legal advice. Distribution of
Creative Commons public licenses does not create a lawyer-client or
other relationship. Creative Commons makes its licenses and related
information available on an "as-is" basis. Creative Commons gives no
warranties regarding its licenses, any material licensed under their
terms and conditions, or any related information. Creative Commons
disclaims all liability for damages resulting from their use to the
fullest extent possible.

Using Creative Commons Public Licenses

Creative Commons public licenses provide a standard set of terms and
conditions that creators and other rights holders may use to share
original works of authorship and other material subject to copyright
and certain other rights specified in the public license below. The
following considerations are for informational purposes only, are not
exhaustive, and do not form part of our licenses.

     Considerations for licensors: Our public licenses are
     intended for use by those authorized to give the public
     permission to use material in ways otherwise restricted by
     copyright and certain other rights. Our licenses are
     irrevocable. Licensors should read and understand the terms
     and conditions of the license they choose before applying it.
     Licensors should also secure all rights necessary before
     applying our licenses so that the public can reuse the
     material as expected. Licensors should clearly mark any
     material not subject to the license. This includes other CC-
     licensed material, or material used under an exception or
     limitation to copyright. More considerations for licensors:
	wiki.creativecommons.org/Considerations_for_licensors

     Considerations for the public: By using one of our public
     licenses, a licensor grants the public permission to use the
     licensed material under specified terms and conditions. If
     the licensor's permission is not necessary for any reason--for
     example, because of any applicable exception or limitation to
     copyright--then that use is not regulated by the license. Our
     licenses grant only permissions under copyright and certain
     other rights that a licensor has authority to grant. Use of
     the licensed material may still be restricted for other
     reasons, including because others have copyright or other
     rights in the material. A licensor may make special requests,
     such as asking that all changes be marked or described.
     Although not required by our licenses, you are encouraged to
     respect those requests where reasonable. More_considerations
     for the public: 
	wiki.creativecommons.org/Considerations_for_licensees

=======================================================================

Creative Commons Attribution 4.0 International Public License

By exercising the Licensed Rights (defined below), You accept and agree
to be bound by the terms and conditions of this Creative Commons
Attribution 4.0 International Public License ("Public License"). To the
extent this Public License may be interpreted as a contract, You are
granted the Licensed Rights in consideration of Your acceptance of
these terms and conditions, and the Licensor grants You such rights in
consideration of benefits the Licensor receives from making the
Licensed Material available under these terms and conditions.


Section 1 -- Definitions.

  a. Adapted Material means material subject to Copyright and Similar
     Rights that is derived from or based upon the Licensed Material
     and in which the Licensed Material is translated, altered,
     arranged, transformed, or otherwise modified in a manner requiring
     permission under the Copyright and Similar Rights held by the
     Licensor. For purposes of this Public License, where the Licensed
     Material is a musical work, performance, or sound recording,
     Adapted Material is always produced where the Licensed Material is
     synched in timed relation with a moving image.

  b. Adapter's License means the license You apply to Your Copyright
     and Similar Rights in Your contributions to Adapted Material in
     accordance with the terms and conditions of this Public License.

  c. Copyright and Similar Rights means copyright and/or similar rights
     closely related to copyright including, without limitation,
     performance, broadcast, sound recording, and Sui Generis Database
     Rights, without regard to how the rights are labeled or
     categorized. For purposes of this Public License, the rights
     specified in Section 2(b)(1)-(2) are not Copyright and Similar
     Rights.

  d. Effective Technological Measures means those measures that, in the
     absence of proper authority, may not be circumvented under laws
     fulfilling obligations under Article 11 of the WIPO Copyright
     Treaty adopted on December 20, 1996, and/or similar international
     agreements.

  e. Exceptions and Limitations means fair use, fair dealing, and/or
     any other exception or limitation to Copyright and Similar Rights
     that applies to Your use of the Licensed Material.

  f. Licensed Material means the artistic or literary work, database,
     or other material to which the Licensor applied this Public
     License.

  g. Licensed Rights means the rights granted to You subject to the
     terms and conditions of this Public License, which are limited to
     all Copyright and Similar Rights that apply to Your use of the
     Licensed Material and that the Licensor has authority to license.

  h. Licensor means the individual(s) or entity(ies) granting rights
     under this Public License.

  i. Share means to provide material to the public by any means or
     process that requires permission under the Licensed Rights, such
     as reproduction, public display, public performance, distribution,
     dissemination, communication, or importation, and to make material
     available to the public including in ways that members of the
     public may access the material from a place and at a time
     individually chosen by them.

  j. Sui Generis Database Rights means rights other than copyright
     resulting from Directive 96/9/EC of the European Parliament and of
     the Council of 11 March 1996 on the legal protection of databases,
     as amended and/or succeeded, as well as other essentially
     equivalent rights anywhere in the world.

  k. You means the individual or entity exercising the Licensed Rights
     under this Public License. Your has a corresponding meaning.


Section 2 -- Scope.

  a. License grant.

       1. Subject to the terms and conditions of this Public License,
          the Licensor hereby grants You a worldwide, royalty-free,
          non-sublicensable, non-exclusive, irrevocable license to
          exercise the Licensed Rights in the Licensed Material to:

            a. reproduce and Share the Licensed Material, in whole or
               in part; and

            b. produce, reproduce, and Share Adapted Material.

       2. Exceptions and Limitations. For the avoidance of doubt, where
          Exceptions and Limitations apply to Your use, this Public
          License does not apply, and You do not need to comply with
          its terms and conditions.

       3. Term. The term of this Public License is specified in Section
          6(a).

       4. Media and formats; technical modifications allowed. The
          Licensor authorizes You to exercise the Licensed Rights in
          all media and formats whether now known or hereafter created,
          and to make technical modifications necessary to do so. The
          Licensor waives and/or agrees not to assert any right or
          authority to forbid You from making technical modifications
          necessary to exercise the Licensed Rights, including
          technical modifications necessary to circumvent Effective
          Technological Measures. For purposes of this Public License,
          simply making modifications authorized by this Section 2(a)
          (4) never produces Adapted Material.

       5. Downstream recipients.

            a. Offer from the Licensor -- Licensed Material. Every
               recipient of the Licensed Material automatically
               receives an offer from the Licensor to exercise the
               Licensed Rights under the terms and conditions of this
               Public License.

            b. No downstream restrictions. You may not offer or impose
               any additional or different terms or conditions on, or
               apply any Effective Technological Measures to, the
               Licensed Material if doing so restricts exercise of the
               Licensed Rights by any recipient of the Licensed
               Material.

       6. No endorsement. Nothing in this Public License constitutes or
          may be construed as permission to assert or imply that You
          are, or that Your use of the Licensed Material is, connected
          with, or sponsored, endorsed, or granted official status by,
          the Licensor or others designated to receive attribution as
          provided in Section 3(a)(1)(A)(i).

  b. Other rights.

       1. Moral rights, such as the right of integrity, are not
          licensed under this Public License, nor are publicity,
          privacy, and/or other similar personality rights; however, to
          the extent possible, the Licensor waives and/or agrees not to
          assert any such rights held by the Licensor to the limited
          extent necessary to allow You to exercise the Licensed
          Rights, but not otherwise.

       2. Patent and trademark rights are not licensed under this
          Public License.

       3. To the extent possible, the Licensor waives any right to
          collect royalties from You for the exercise of the Licensed
          Rights, whether directly or through a collecting society
          under any voluntary or waivable statutory or compulsory
          licensing scheme. In all other cases the Licensor expressly
          reserves any right to collect such royalties.


Section 3 -- License Conditions.

Your exercise of the Licensed Rights is expressly made subject to the
following conditions.

  a. Attribution.

       1. If You Share the Licensed Material (including in modified
          form), You must:

            a. retain the following if it is supplied by the Licensor
               with the Licensed Material:

                 i. identification of the creator(s) of the Licensed
                    Material and any others designated to receive
                    attribution, in any reasonable manner requested by
                    the Licensor (including by pseudonym if
                    designated);

                ii. a copyright notice;

               iii. a notice that refers to this Public License;

                iv. a notice that refers to the disclaimer of
                    warranties;

                 v. a URI or hyperlink to the Licensed Material to the
                    extent reasonably practicable;

            b. indicate if You modified the Licensed Material and
               retain an indication of any previous modifications; and

            c. indicate the Licensed Material is licensed under this
               Public License, and include the text of, or the URI or
               hyperlink to, this Public License.

       2. You may satisfy the conditions in Section 3(a)(1) in any
          reasonable manner based on the medium, means, and context in
          which You Share the Licensed Material. For example, it may be
          reasonable to satisfy the conditions by providing a URI or
          hyperlink to a resource that includes the required
          information.

       3. If requested by the Licensor, You must remove any of the
          information required by Section 3(a)(1)(A) to the extent
          reasonably practicable.

       4. If You Share Adapted Material You produce, the Adapter's
          License You apply must not prevent recipients of the Adapted
          Material from complying with this Public License.


Section 4 -- Sui Generis Database Rights.

Where the Licensed Rights include Sui Generis Database Rights that
apply to Your use of the Licensed Material:

  a. for the avoidance of doubt, Section 2(a)(1) grants You the right
     to extract, reuse, reproduce, and Share all or a substantial
     portion of the contents of the database;

  b. if You include all or a substantial portion of the database
     contents in a database in which You have Sui Generis Database
     Rights, then the database in which You have Sui Generis Database
     Rights (but not its individual contents) is Adapted Material; and

  c. You must comply with the conditions in Section 3(a) if You Share
     all or a substantial portion of the contents of the database.

For the avoidance of doubt, this Section 4 supplements and does not
replace Your obligations under this Public License where the Licensed
Rights include other Copyright and Similar Rights.


Section 5 -- Disclaimer of Warranties and Limitation of Liability.

  a. UNLESS OTHERWISE SEPARATELY UNDERTAKEN BY THE LICENSOR, TO THE
     EXTENT POSSIBLE, THE LICENSOR OFFERS THE LICENSED MATERIAL AS-IS
     AND AS-AVAILABLE, AND MAKES NO REPRESENTATIONS OR WARRANTIES OF
     ANY KIND CONCERNING THE LICENSED MATERIAL, WHETHER EXPRESS,
     IMPLIED, STATUTORY, OR OTHER. THIS INCLUDES, WITHOUT LIMITATION,
     WARRANTIES OF TITLE, MERCHANTABILITY, FITNESS FOR A PARTICULAR
     PURPOSE, NON-INFRINGEMENT, ABSENCE OF LATENT OR OTHER DEFECTS,
     ACCURACY, OR THE PRESENCE OR ABSENCE OF ERRORS, WHETHER OR NOT
     KNOWN OR DISCOVERABLE. WHERE DISCLAIMERS OF WARRANTIES ARE NOT
     ALLOWED IN FULL OR IN PART, THIS DISCLAIMER MAY NOT APPLY TO YOU.

  b. TO THE EXTENT POSSIBLE, IN NO EVENT WILL THE LICENSOR BE LIABLE
     TO YOU ON ANY LEGAL THEORY (INCLUDING, WITHOUT LIMITATION,
     NEGLIGENCE) OR OTHERWISE FOR ANY DIRECT, SPECIAL, INDIRECT,
     INCIDENTAL, CONSEQUENTIAL, PUNITIVE, EXEMPLARY, OR OTHER LOSSES,
     COSTS, EXPENSES, OR DAMAGES ARISING OUT OF THIS PUBLIC LICENSE OR
     USE OF THE LICENSED MATERIAL, EVEN IF THE LICENSOR HAS BEEN
     ADVISED OF THE POSSIBILITY OF SUCH LOSSES, COSTS, EXPENSES, OR
     DAMAGES. WHERE A LIMITATION OF LIABILITY IS NOT ALLOWED IN FULL OR
     IN PART, THIS LIMITATION MAY NOT APPLY TO YOU.

  c. The disclaimer of warranties and limitation of liability provided
     above shall be interpreted in a manner that, to the extent
     possible, most closely approximates an absolute disclaimer and
     waiver of all liability.


Section 6 -- Term and Termination.

  a. This Public License applies for the term of the Copyright and
     Similar Rights licensed here. However, if You fail to comply with
     this Public License, then Your rights under this Public License
     terminate automatically.

  b. Where Your right to use the Licensed Material has terminated under
     Section 6(a), it reinstates:

       1. automatically as of the date the violation is cured, provided
          it is cured within 30 days of Your discovery of the
          violation; or

       2. upon express reinstatement by the Licensor.

     For the avoidance of doubt, this Section 6(b) does not affect any
     right the Licensor may have to seek remedies for Your violations
     of this Public License.

  c. For the avoidance of doubt, the Licensor may also offer the
     Licensed Material under separate terms or conditions or stop
     distributing the Licensed Material at any time; however, doing so
     will not terminate this Public License.

  d. Sections 1, 5, 6, 7, and 8 survive termination of this Public
     License.


Section 7 -- Other Terms and Conditions.

  a. The Licensor shall not be bound by any additional or different
     terms or conditions communicated by You unless expressly agreed.

  b. Any arrangements, understandings, or agreements regarding the
     Licensed Material not stated herein are separate from and
     independent of the terms and conditions of this Public License.


Section 8 -- Interpretation.

  a. For the avoidance of doubt, this Public License does not, and
     shall not be interpreted to, reduce, limit, restrict, or impose
     conditions on any use of the Licensed Material that could lawfully
     be made without permission under this Public License.

  b. To the extent possible, if any provision of this Public License is
     deemed unenforceable, it shall be automatically reformed to the
     minimum extent necessary to make it enforceable. If the provision
     cannot be reformed, it shall be severed from this Public License
     without affecting the enforceability of the remaining terms and
     conditions.

  c. No term or condition of this Public License will be waived and no
     failure to comply consented to unless expressly agreed to by the
     Licensor.

  d. Nothing in this Public License constitutes or may be interpreted
     as a limitation upon, or waiver of, any privileges and immunities
     that apply to the Licensor or You, including from the legal
     processes of any jurisdiction or authority.


=======================================================================

Creative Commons is not a party to its public
licenses. Notwithstanding, Creative Commons may elect to apply one of
its public licenses to material it publishes and in those instances
will be considered the “Licensor.” The text of the Creative Commons
public licenses is dedicated to the public domain under the CC0 Public
Domain Dedication. Except for the limited purpose of indicating that
material is shared under a Creative Commons public license or as
otherwise permitted by the Creative Commons policies published at
creativecommons.org/policies, Creative Commons does not authorize the
use of the trademark "Creative Commons" or any other trademark or logo
of Creative Commons without its prior written consent including,
without limitation, in connection with any unauthorized modifications
to any of its public licenses or any other arrangements,
understandings, or agreements concerning use of licensed material. For
the avoidance of doubt, this paragraph does not form part of the
public licenses.

Creative Commons may be contacted at creativecommons.org.
```

#### EPL-2.0

Used by: elkjs@0.12.1.

Text from elkjs@0.12.1, LICENSE.md (that file covers EPL-2.0 OR GPL-3.0-or-later):

```text
# Eclipse Public License - v 2.0

THE ACCOMPANYING PROGRAM IS PROVIDED UNDER THE TERMS OF THIS ECLIPSE
PUBLIC LICENSE (“AGREEMENT”). ANY USE, REPRODUCTION OR DISTRIBUTION OF
THE PROGRAM CONSTITUTES RECIPIENT'S ACCEPTANCE OF THIS AGREEMENT.

## 1. DEFINITIONS

“Contribution” means:

-   a\) in the case of the initial Contributor, the initial content
    Distributed under this Agreement, and
-   b\) in the case of each subsequent Contributor:
    -   i\) changes to the Program, and
    -   ii\) additions to the Program;

    where such changes and/or additions to the Program originate from
    and are Distributed by that particular Contributor. A Contribution
    “originates” from a Contributor if it was added to the Program by
    such Contributor itself or anyone acting on such Contributor's
    behalf. Contributions do not include changes or additions to the
    Program that are not Modified Works.

“Contributor” means any person or entity that Distributes the Program.

“Licensed Patents” mean patent claims licensable by a Contributor which
are necessarily infringed by the use or sale of its Contribution alone
or when combined with the Program.

“Program” means the Contributions Distributed in accordance with this
Agreement.

“Recipient” means anyone who receives the Program under this Agreement
or any Secondary License (as applicable), including Contributors.

“Derivative Works” shall mean any work, whether in Source Code or other
form, that is based on (or derived from) the Program and for which the
editorial revisions, annotations, elaborations, or other modifications
represent, as a whole, an original work of authorship.

“Modified Works” shall mean any work in Source Code or other form that
results from an addition to, deletion from, or modification of the
contents of the Program, including, for purposes of clarity any new file
in Source Code form that contains any contents of the Program. Modified
Works shall not include works that contain only declarations,
interfaces, types, classes, structures, or files of the Program solely
in each case in order to link to, bind by name, or subclass the Program
or Modified Works thereof.

“Distribute” means the acts of a) distributing or b) making available in
any manner that enables the transfer of a copy.

“Source Code” means the form of a Program preferred for making
modifications, including but not limited to software source code,
documentation source, and configuration files.

“Secondary License” means either the GNU General Public License, Version
2.0, or any later versions of that license, including any exceptions or
additional permissions as identified by the initial Contributor.

## 2. GRANT OF RIGHTS

-   a\) Subject to the terms of this Agreement, each Contributor hereby
    grants Recipient a non-exclusive, worldwide, royalty-free copyright
    license to reproduce, prepare Derivative Works of, publicly display,
    publicly perform, Distribute and sublicense the Contribution of such
    Contributor, if any, and such Derivative Works.
-   b\) Subject to the terms of this Agreement, each Contributor hereby
    grants Recipient a non-exclusive, worldwide, royalty-free patent license
    under Licensed Patents to make, use, sell, offer to sell, import and
    otherwise transfer the Contribution of such Contributor, if any, in
    Source Code or other form. This patent license shall apply to the
    combination of the Contribution and the Program if, at the time the
    Contribution is added by the Contributor, such addition of the
    Contribution causes such combination to be covered by the
    Licensed Patents. The patent license shall not apply to any other
    combinations which include the Contribution. No hardware per se is
    licensed hereunder.
-   c\) Recipient understands that although each Contributor grants the
    licenses to its Contributions set forth herein, no assurances are
    provided by any Contributor that the Program does not infringe the
    patent or other intellectual property rights of any other entity. Each
    Contributor disclaims any liability to Recipient for claims brought by
    any other entity based on infringement of intellectual property rights
    or otherwise. As a condition to exercising the rights and licenses
    granted hereunder, each Recipient hereby assumes sole responsibility to
    secure any other intellectual property rights needed, if any. For
    example, if a third party patent license is required to allow Recipient
    to Distribute the Program, it is Recipient's responsibility to acquire
    that license before distributing the Program.
-   d\) Each Contributor represents that to its knowledge it has sufficient
    copyright rights in its Contribution, if any, to grant the copyright
    license set forth in this Agreement.
-   e\) Notwithstanding the terms of any Secondary License, no Contributor
    makes additional grants to any Recipient (other than those set forth in
    this Agreement) as a result of such Recipient's receipt of the Program
    under the terms of a Secondary License (if permitted under the terms of
    Section 3).

## 3. REQUIREMENTS

3.1 If a Contributor Distributes the Program in any form, then:

-   a\) the Program must also be made available as Source Code, in accordance
    with section 3.2, and the Contributor must accompany the Program with a
    statement that the Source Code for the Program is available under this
    Agreement, and informs Recipients how to obtain it in a reasonable
    manner on or through a medium customarily used for software exchange;
    and
-   b\) the Contributor may Distribute the Program under a license different
    than this Agreement, provided that such license:
    -   i\) effectively disclaims on behalf of all other Contributors all
        warranties and conditions, express and implied, including warranties or
        conditions of title and non-infringement, and implied warranties or
        conditions of merchantability and fitness for a particular purpose;
    -   ii\) effectively excludes on behalf of all other Contributors all
        liability for damages, including direct, indirect, special, incidental
        and consequential damages, such as lost profits;
    -   iii\) does not attempt to limit or alter the recipients' rights in the
        Source Code under section 3.2; and
    -   iv\) requires any subsequent distribution of the Program by any party to
        be under a license that satisfies the requirements of this section 3.

3.2 When the Program is Distributed as Source Code:

-   a\) it must be made available under this Agreement, or if the Program (i)
    is combined with other material in a separate file or files made
    available under a Secondary License, and (ii) the initial Contributor
    attached to the Source Code the notice described in Exhibit A of this
    Agreement, then the Program may be made available under the terms of
    such Secondary Licenses, and
-   b\) a copy of this Agreement must be included with each copy of
    the Program.

3.3 Contributors may not remove or alter any copyright, patent,
trademark, attribution notices, disclaimers of warranty, or limitations
of liability (‘notices’) contained within the Program from any copy of
the Program which they Distribute, provided that Contributors may add
their own appropriate notices.

## 4. COMMERCIAL DISTRIBUTION

Commercial distributors of software may accept certain responsibilities
with respect to end users, business partners and the like. While this
license is intended to facilitate the commercial use of the Program, the
Contributor who includes the Program in a commercial product offering
should do so in a manner which does not create potential liability for
other Contributors. Therefore, if a Contributor includes the Program in
a commercial product offering, such Contributor (“Commercial
Contributor”) hereby agrees to defend and indemnify every other
Contributor (“Indemnified Contributor”) against any losses, damages and
costs (collectively “Losses”) arising from claims, lawsuits and other
legal actions brought by a third party against the Indemnified
Contributor to the extent caused by the acts or omissions of such
Commercial Contributor in connection with its distribution of the
Program in a commercial product offering. The obligations in this
section do not apply to any claims or Losses relating to any actual or
alleged intellectual property infringement. In order to qualify, an
Indemnified Contributor must: a) promptly notify the Commercial
Contributor in writing of such claim, and b) allow the Commercial
Contributor to control, and cooperate with the Commercial Contributor
in, the defense and any related settlement negotiations. The Indemnified
Contributor may participate in any such claim at its own expense.

For example, a Contributor might include the Program in a commercial
product offering, Product X. That Contributor is then a Commercial
Contributor. If that Commercial Contributor then makes performance
claims, or offers warranties related to Product X, those performance
claims and warranties are such Commercial Contributor's responsibility
alone. Under this section, the Commercial Contributor would have to
defend claims against the other Contributors related to those
performance claims and warranties, and if a court requires any other
Contributor to pay any damages as a result, the Commercial Contributor
must pay those damages.

## 5. NO WARRANTY {#warranty}

EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, AND TO THE EXTENT
PERMITTED BY APPLICABLE LAW, THE PROGRAM IS PROVIDED ON AN “AS IS”
BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR
IMPLIED INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF
TITLE, NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR
PURPOSE. Each Recipient is solely responsible for determining the
appropriateness of using and distributing the Program and assumes all
risks associated with its exercise of rights under this Agreement,
including but not limited to the risks and costs of program errors,
compliance with applicable laws, damage to or loss of data, programs or
equipment, and unavailability or interruption of operations.

## 6. DISCLAIMER OF LIABILITY {#disclaimer}

EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, AND TO THE EXTENT
PERMITTED BY APPLICABLE LAW, NEITHER RECIPIENT NOR ANY CONTRIBUTORS
SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING WITHOUT LIMITATION LOST
PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OR DISTRIBUTION OF THE PROGRAM OR THE
EXERCISE OF ANY RIGHTS GRANTED HEREUNDER, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

## 7. GENERAL

If any provision of this Agreement is invalid or unenforceable under
applicable law, it shall not affect the validity or enforceability of
the remainder of the terms of this Agreement, and without further action
by the parties hereto, such provision shall be reformed to the minimum
extent necessary to make such provision valid and enforceable.

If Recipient institutes patent litigation against any entity (including
a cross-claim or counterclaim in a lawsuit) alleging that the Program
itself (excluding combinations of the Program with other software or
hardware) infringes such Recipient's patent(s), then such Recipient's
rights granted under Section 2(b) shall terminate as of the date such
litigation is filed.

All Recipient's rights under this Agreement shall terminate if it fails
to comply with any of the material terms or conditions of this Agreement
and does not cure such failure in a reasonable period of time after
becoming aware of such noncompliance. If all Recipient's rights under
this Agreement terminate, Recipient agrees to cease use and distribution
of the Program as soon as reasonably practicable. However, Recipient's
obligations under this Agreement and any licenses granted by Recipient
relating to the Program shall continue and survive.

Everyone is permitted to copy and distribute copies of this Agreement,
but in order to avoid inconsistency the Agreement is copyrighted and may
only be modified in the following manner. The Agreement Steward reserves
the right to publish new versions (including revisions) of this
Agreement from time to time. No one other than the Agreement Steward has
the right to modify this Agreement. The Eclipse Foundation is the
initial Agreement Steward. The Eclipse Foundation may assign the
responsibility to serve as the Agreement Steward to a suitable separate
entity. Each new version of the Agreement will be given a distinguishing
version number. The Program (including Contributions) may always be
Distributed subject to the version of the Agreement under which it was
received. In addition, after a new version of the Agreement is
published, Contributor may elect to Distribute the Program (including
its Contributions) under the new version.

Except as expressly stated in Sections 2(a) and 2(b) above, Recipient
receives no rights or licenses to the intellectual property of any
Contributor under this Agreement, whether expressly, by implication,
estoppel or otherwise. All rights in the Program not expressly granted
under this Agreement are reserved. Nothing in this Agreement is intended
to be enforceable by any entity that is not a Contributor or Recipient.
No third-party beneficiary rights are created under this Agreement.

## Exhibit A – Form of Secondary Licenses Notice {#exhibit-a}

“This Source Code may also be made available under the following
Secondary Licenses when the conditions for such availability set forth
in the Eclipse Public License, v. 2.0 are satisfied: GNU General Public License v3.0 or later”

> Simply including a copy of this Agreement, including this Exhibit A is
> not sufficient to license the Source Code under Secondary Licenses.
>
> If it is not possible or desirable to put the notice in a particular
> file, then You may include the notice in a location (such as a LICENSE
> file in a relevant directory) where a recipient would be likely to
> look for such a notice.
>
> You may add additional accurate notices of copyright ownership.
```

#### GPL-3.0-or-later

Used by: elkjs@0.12.1.

No package installed on every platform ships this licence's text in a licence file, so the text is not reproduced here. Reference text: https://spdx.org/licenses/GPL-3.0-or-later.html

#### ISC

Used by: @ungap/structured-clone@1.4.0, cliui@9.0.1, d3@7.9.2, d3-array@3.2.5, d3-axis@3.0.1, d3-brush@3.0.1, d3-chord@3.0.2, d3-color@3.1.1, d3-contour@4.0.3, d3-delaunay@6.0.6, d3-dispatch@3.0.2, d3-drag@3.0.1, d3-dsv@3.0.2, d3-fetch@3.0.2, d3-force@3.0.1, d3-format@3.1.3, d3-geo@3.1.2, d3-hierarchy@3.1.3, d3-interpolate@3.0.2, d3-path@3.1.1, d3-polygon@3.0.2, d3-quadtree@3.0.2, d3-random@3.0.2, d3-scale@4.0.3, d3-scale-chromatic@3.1.1, d3-selection@3.0.1, d3-shape@3.2.1, d3-time@3.1.1, d3-time-format@4.1.1, d3-timer@3.0.2, d3-transition@3.0.2, d3-zoom@3.0.1, delaunator@5.1.0, get-caller-file@2.0.5, hast-util-from-dom@5.0.1, internmap@1.0.1, internmap@2.0.3, isexe@2.0.0, lucide-react@1.77.0, pg-int8@1.0.1, picocolors@1.1.1, potpack@1.0.2, semver@7.8.6, split2@4.2.0, which@2.0.2, y18n@5.0.8, yargs-parser@22.0.0.

Text from @ungap/structured-clone@1.4.0, LICENSE:

```text
ISC License

Copyright (c) 2021, Andrea Giammarchi, @WebReflection

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

#### LGPL-3.0-or-later

Used by: @img/sharp-libvips-darwin-arm64@1.3.4, @img/sharp-libvips-darwin-x64@1.3.4, @img/sharp-libvips-linux-arm@1.3.4, @img/sharp-libvips-linux-arm64@1.3.4, @img/sharp-libvips-linux-ppc64@1.3.4, @img/sharp-libvips-linux-riscv64@1.3.4, @img/sharp-libvips-linux-s390x@1.3.4, @img/sharp-libvips-linux-x64@1.3.4, @img/sharp-libvips-linuxmusl-arm64@1.3.4, @img/sharp-libvips-linuxmusl-x64@1.3.4, @img/sharp-wasm32@0.35.5, @img/sharp-win32-arm64@0.35.5, @img/sharp-win32-ia32@0.35.5, @img/sharp-win32-x64@0.35.5.

No package installed on every platform ships this licence's text in a licence file, so the text is not reproduced here. Reference text: https://spdx.org/licenses/LGPL-3.0-or-later.html

#### MIT

Used by: @antfu/install-pkg@2.1.0, @babel/runtime@7.29.15, @braintree/sanitize-url@7.1.2, @emnapi/runtime@1.11.3, @floating-ui/core@1.8.0, @floating-ui/dom@1.8.0, @floating-ui/react-dom@2.1.9, @floating-ui/utils@0.2.12, @iconify/types@2.0.0, @iconify/utils@3.1.7, @img/colour@1.1.0, @img/sharp-wasm32@0.35.5, @mermaid-js/parser@1.2.1, @mermaid-js/parser@2.0.1, @monogrid/gainmap-js@3.7.3, @next/env@16.4.6, @next/swc-darwin-arm64@16.4.6, @next/swc-darwin-x64@16.4.6, @next/swc-linux-arm64-gnu@16.4.6, @next/swc-linux-arm64-musl@16.4.6, @next/swc-linux-x64-gnu@16.4.6, @next/swc-linux-x64-musl@16.4.6, @next/swc-win32-arm64-msvc@16.4.6, @next/swc-win32-x64-msvc@16.4.6, @radix-ui/number@1.1.3, @radix-ui/primitive@1.2.0, @radix-ui/react-accessible-icon@1.2.0, @radix-ui/react-accordion@1.3.1, @radix-ui/react-alert-dialog@1.2.1, @radix-ui/react-arrow@1.1.17, @radix-ui/react-aspect-ratio@1.2.0, @radix-ui/react-avatar@1.3.1, @radix-ui/react-checkbox@1.4.1, @radix-ui/react-collapsible@1.2.1, @radix-ui/react-collection@1.2.0, @radix-ui/react-compose-refs@1.1.5, @radix-ui/react-context@1.3.0, @radix-ui/react-context-menu@2.4.1, @radix-ui/react-dialog@1.3.1, @radix-ui/react-direction@1.2.0, @radix-ui/react-dismissable-layer@1.2.1, @radix-ui/react-dropdown-menu@2.2.1, @radix-ui/react-focus-guards@1.2.0, @radix-ui/react-focus-scope@1.3.1, @radix-ui/react-form@0.3.0, @radix-ui/react-hover-card@1.2.1, @radix-ui/react-id@1.1.4, @radix-ui/react-label@2.1.17, @radix-ui/react-menu@2.2.1, @radix-ui/react-menubar@1.2.1, @radix-ui/react-navigation-menu@1.4.1, @radix-ui/react-one-time-password-field@0.2.1, @radix-ui/react-password-toggle-field@0.2.1, @radix-ui/react-popover@1.3.1, @radix-ui/react-popper@1.4.0, @radix-ui/react-portal@1.2.0, @radix-ui/react-presence@1.1.11, @radix-ui/react-primitive@2.2.0, @radix-ui/react-progress@1.2.1, @radix-ui/react-radio-group@1.5.1, @radix-ui/react-roving-focus@1.2.1, @radix-ui/react-scroll-area@1.4.0, @radix-ui/react-select@2.4.1, @radix-ui/react-separator@1.2.0, @radix-ui/react-slider@1.6.1, @radix-ui/react-slot@1.5.0, @radix-ui/react-switch@1.4.1, @radix-ui/react-tabs@1.2.1, @radix-ui/react-toast@1.3.1, @radix-ui/react-toggle@1.2.1, @radix-ui/react-toggle-group@1.2.1, @radix-ui/react-toolbar@1.2.1, @radix-ui/react-tooltip@1.4.1, @radix-ui/react-use-callback-ref@1.1.5, @radix-ui/react-use-controllable-state@1.3.0, @radix-ui/react-use-effect-event@0.0.5, @radix-ui/react-use-escape-keydown@1.1.6, @radix-ui/react-use-is-hydrated@0.1.3, @radix-ui/react-use-layout-effect@1.1.4, @radix-ui/react-use-previous@1.1.4, @radix-ui/react-use-rect@1.1.4, @radix-ui/react-use-size@1.1.5, @radix-ui/react-visually-hidden@1.2.13, @radix-ui/rect@1.1.3, @react-three/drei@10.7.9, @react-three/fiber@9.8.2, @shikijs/core@4.6.0, @shikijs/engine-javascript@4.6.0, @shikijs/engine-oniguruma@4.6.0, @shikijs/langs@4.6.0, @shikijs/primitive@4.6.0, @shikijs/themes@4.6.0, @shikijs/types@4.6.0, @shikijs/vscode-textmate@10.1.0, @standard-schema/spec@1.1.0, @tanstack/query-core@5.108.2, @tanstack/react-query@5.108.2, @tweenjs/tween.js@23.1.3, @types/d3@7.4.3, @types/d3-array@3.2.2, @types/d3-axis@3.0.6, @types/d3-brush@3.0.6, @types/d3-chord@3.0.6, @types/d3-color@3.1.3, @types/d3-contour@3.0.6, @types/d3-delaunay@6.0.4, @types/d3-dispatch@3.0.7, @types/d3-drag@3.0.7, @types/d3-dsv@3.0.7, @types/d3-ease@3.0.2, @types/d3-fetch@3.0.7, @types/d3-force@3.0.10, @types/d3-format@3.0.4, @types/d3-geo@3.1.1, @types/d3-hierarchy@3.1.7, @types/d3-interpolate@3.0.4, @types/d3-path@3.1.1, @types/d3-polygon@3.0.2, @types/d3-quadtree@3.0.6, @types/d3-random@3.0.4, @types/d3-scale@4.0.9, @types/d3-scale-chromatic@3.1.0, @types/d3-selection@3.0.12, @types/d3-shape@3.2.0, @types/d3-time@3.0.4, @types/d3-time-format@4.0.3, @types/d3-timer@3.0.2, @types/d3-transition@3.0.9, @types/d3-zoom@3.0.9, @types/debug@4.1.13, @types/draco3d@1.4.10, @types/estree@1.0.10, @types/estree-jsx@1.0.5, @types/geojson@7946.0.16, @types/hast@3.0.5, @types/katex@0.16.8, @types/mdast@4.0.4, @types/ms@2.1.0, @types/node@22.20.5, @types/offscreencanvas@2019.7.3, @types/pg@8.23.1, @types/react@19.3.0, @types/react-dom@19.3.0, @types/react-reconciler@0.28.9, @types/stats.js@0.17.4, @types/three@0.187.0, @types/trusted-types@2.0.7, @types/unist@2.0.11, @types/unist@3.0.3, @types/webxr@0.5.24, @upsetjs/venn.js@2.0.0, @use-gesture/core@10.3.1, @use-gesture/react@10.3.1, @xyflow/react@13.0.2, @xyflow/system@1.0.0, ansi-regex@6.6.0, ansi-styles@6.2.3, aria-hidden@1.2.6, bail@2.0.2, balanced-match@4.0.4, base64-js@1.5.1, bidi-js@1.1.0, brace-expansion@5.0.13, buffer@6.0.3, camera-controls@3.1.2, ccount@2.0.1, character-entities@2.0.2, character-entities-html4@2.1.0, character-entities-legacy@3.0.0, character-reference-invalid@2.0.1, classcat@5.0.5, client-only@0.0.1, clsx@2.1.1, cmdk@1.1.1, cn@0.5.2, comma-separated-tokens@2.0.3, commander@15.1.0, commander@7.2.0, commander@8.3.0, cose-base@1.0.3, cose-base@2.2.0, cross-env@7.0.3, cross-spawn@7.0.6, csstype@3.2.4, cytoscape@3.35.0, cytoscape-cose-bilkent@4.1.0, cytoscape-fcose@2.2.0, dagre-d3-es@7.0.14, dayjs@1.11.23, debug@4.4.3, decode-named-character-reference@1.3.0, dequal@2.0.3, detect-gpu@5.0.70, detect-node-es@1.1.0, devlop@1.1.0, embla-carousel@8.6.0, embla-carousel-react@8.6.0, embla-carousel-reactive-utils@8.6.0, emoji-regex@10.6.0, es-toolkit@1.53.2, escalade@3.2.0, escape-string-regexp@5.0.0, estree-util-is-identifier-name@3.0.0, eventsource-parser@3.1.1, extend@3.0.2, fastdom@1.0.12, fflate@0.6.11, fflate@0.8.3, framer-motion@14.14.0, get-east-asian-width@1.7.0, get-nonce@1.0.1, glsl-noise@0.0.0, hachure-fill@0.5.2, hast-util-from-html@2.1.0, hast-util-from-html-isomorphic@2.0.0, hast-util-from-parse5@8.0.4, hast-util-parse-selector@4.0.0, hast-util-raw@9.2.1, hast-util-sanitize@5.0.2, hast-util-to-html@9.0.7, hast-util-to-jsx-runtime@2.3.7, hast-util-to-parse5@8.0.1, hast-util-to-text@4.0.5, hast-util-whitespace@3.0.0, hastscript@9.0.3, html-url-attributes@3.0.1, html-void-elements@3.0.0, iconv-lite@0.6.3, immediate@3.0.6, import-meta-resolve@4.2.0, inline-style-parser@0.2.9, is-alphabetical@2.0.1, is-alphanumerical@2.0.1, is-decimal@2.0.1, is-hexadecimal@2.0.1, is-plain-obj@4.1.0, is-promise@2.2.2, its-fine@2.1.1, jiti@2.7.0, katex@0.16.47, katex@0.18.10, khroma@2.1.0, layout-base@1.0.2, layout-base@2.0.1, lie@3.3.0, lodash-es@4.18.1, longest-streak@3.1.0, maath@0.10.8, markdown-table@3.1.0, marked@16.4.2, marked@18.2.1, mdast-util-find-and-replace@3.0.5, mdast-util-from-markdown@2.1.0, mdast-util-gfm@3.1.0, mdast-util-gfm-autolink-literal@2.1.2, mdast-util-gfm-footnote@2.1.0, mdast-util-gfm-strikethrough@2.0.1, mdast-util-gfm-table@2.0.1, mdast-util-gfm-task-list-item@2.0.1, mdast-util-math@3.0.0, mdast-util-mdx-expression@2.0.1, mdast-util-mdx-jsx@3.2.2, mdast-util-mdxjs-esm@2.0.1, mdast-util-phrasing@4.1.0, mdast-util-to-hast@13.2.2, mdast-util-to-markdown@2.2.4, mdast-util-to-markdown-cjk-friendly@1.0.2, mdast-util-to-markdown-cjk-friendly-gfm-strikethrough@1.0.2, mdast-util-to-string@4.0.0, mermaid@11.17.2, mermaid@12.3.0, meshline@3.3.1, meshoptimizer@1.1.1, micromark@4.0.3, micromark-core-commonmark@2.0.4, micromark-extension-cjk-friendly@2.0.2, micromark-extension-cjk-friendly-gfm-strikethrough@2.0.1, micromark-extension-cjk-friendly-util@3.0.1, micromark-extension-gfm@3.0.0, micromark-extension-gfm-autolink-literal@2.1.0, micromark-extension-gfm-footnote@2.1.0, micromark-extension-gfm-strikethrough@2.1.0, micromark-extension-gfm-table@2.1.2, micromark-extension-gfm-tagfilter@2.0.0, micromark-extension-gfm-task-list-item@2.1.0, micromark-extension-math@3.1.0, micromark-factory-destination@2.0.1, micromark-factory-label@2.0.1, micromark-factory-space@2.1.0, micromark-factory-title@2.0.1, micromark-factory-whitespace@2.0.1, micromark-util-character@2.1.1, micromark-util-chunked@2.0.1, micromark-util-classify-character@2.0.1, micromark-util-combine-extensions@2.0.1, micromark-util-decode-numeric-character-reference@2.0.2, micromark-util-decode-string@2.0.1, micromark-util-edit-map@1.0.0, micromark-util-encode@2.0.1, micromark-util-html-tag-name@2.0.1, micromark-util-normalize-identifier@2.0.1, micromark-util-resolve-all@2.0.1, micromark-util-sanitize-uri@2.0.1, micromark-util-subtokenize@2.1.0, micromark-util-symbol@2.0.1, micromark-util-types@2.0.3, motion@14.14.0, motion-dom@14.14.0, motion-utils@14.7.0, ms@2.1.3, nanoid@3.3.20, nanoid@6.0.2, next@16.4.6, next-themes@0.4.6, node-pg-migrate@9.0.0, oniguruma-parser@0.12.2, oniguruma-to-es@4.3.6, package-manager-detector@1.9.0, parse-entities@4.0.2, parse5@8.1.1, path-data-parser@0.1.0, path-key@3.1.1, pg@8.23.1, pg-cloudflare@1.4.1, pg-connection-string@2.14.1, pg-pool@3.14.0, pg-protocol@1.16.1, pg-types@2.2.0, pgpass@1.0.5, pkce-challenge@5.0.1, points-on-curve@0.2.0, points-on-path@0.2.1, postcss@8.5.23, postgres-array@2.0.0, postgres-bytea@1.0.1, postgres-date@1.0.7, postgres-interval@1.2.0, property-information@7.2.0, radix-ui@1.8.1, react@19.3.0, react-compiler-runtime@1.0.0, react-dom@19.3.0, react-markdown@10.1.0, react-remove-scroll@2.7.2, react-remove-scroll-bar@2.3.8, react-style-singleton@2.2.3, react-use-measure@2.1.7, regex@6.1.0, regex-recursion@6.0.2, regex-utilities@2.3.0, rehype-harden@1.1.9, rehype-katex@7.0.1, rehype-raw@7.0.0, rehype-sanitize@6.0.0, remark-cjk-friendly@2.3.4, remark-cjk-friendly-gfm-strikethrough@2.3.3, remark-gfm@4.0.1, remark-math@6.0.0, remark-parse@11.0.0, remark-rehype@11.1.2, remark-stringify@11.0.0, require-from-string@2.0.2, roughjs@4.6.6, safer-buffer@2.1.2, scheduler@0.28.0, shebang-command@2.0.0, shebang-regex@3.0.0, shiki@4.6.0, sonner@2.0.8, space-separated-tokens@2.0.2, stats-gl@2.4.2, stats.js@0.17.0, strictdom@1.0.1, string-width@7.2.0, stringify-entities@4.0.5, strip-ansi@7.2.0, style-to-object@2.0.2, styled-jsx@5.1.6, stylis@4.4.0, suspend-react@0.1.3, swr@2.5.1, tailwind-merge@3.7.1, three@0.170.0, three@0.187.0, three-mesh-bvh@0.8.3, three-stdlib@2.36.1, throttleit@2.1.0, tinyexec@1.3.1, trim-lines@3.0.1, troika-three-text@0.52.5, troika-three-utils@0.52.5, troika-worker-utils@0.52.0, trough@2.2.0, ts-dedent@2.3.0, tunnel-rat@0.1.2, undici-types@6.21.0, unified@11.0.5, unist-util-is@6.0.1, unist-util-position@5.0.0, unist-util-remove-position@5.0.0, unist-util-stringify-position@4.0.0, unist-util-visit@5.2.0, unist-util-visit-parents@6.1.0, use-callback-ref@1.3.3, use-sidecar@1.1.3, use-stick-to-bottom@1.1.6, use-sync-external-store@1.7.0, utility-types@3.11.0, uuid@14.0.3, vfile@6.0.3, vfile-location@5.0.4, vfile-message@4.0.4, web-namespaces@2.0.1, webgl-constants@1.1.1, webgl-sdf-generator@1.1.1, wrap-ansi@9.0.2, xtend@4.0.2, yargs@18.0.0, zod@4.6.7, zustand@4.5.7, zustand@5.1.0, zwitch@2.0.4.

Text from @antfu/install-pkg@2.1.0, LICENSE:

```text
MIT License

Copyright (c) 2021 Anthony Fu <https://github.com/antfu>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### MPL-2.0

Used by: dompurify@3.4.18.

No package installed on every platform ships this licence's text in a licence file, so the text is not reproduced here. Reference text: https://spdx.org/licenses/MPL-2.0.html

#### OFL-1.1

Used by: @fontsource-variable/inter@5.3.0, @fontsource-variable/jetbrains-mono@5.3.0.

Text from @fontsource-variable/inter@5.3.0, LICENSE:

```text
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) Inter-Italic[opsz,wght].ttf: Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

#### Unlicense

Used by: robust-predicates@3.0.3.

Text from robust-predicates@3.0.3, LICENSE:

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org>
```

[//]: # (python:start)
## Python packages (planner)

Read with importlib.metadata from Python 3.13 after `pip install -r planner/requirements.txt`: 19 packages, 3 listed in requirements.txt and 16 pulled in by them. requirements.txt pins minor versions only, so the versions below are those installed where this file was generated. "(classifier)" means the package declares no licence identifier and the licence is its Trove classifier.

| Package | Version | Licence | Home page | Required by |
| --- | --- | --- | --- | --- |
| annotated-types | 0.8.0 | MIT | https://github.com/annotated-types/annotated-types | pydantic |
| anyio | 4.15.1 | MIT | https://github.com/agronholm/anyio | starlette, watchfiles |
| click | 8.5.0 | BSD-3-Clause | https://github.com/pallets/click/ | uvicorn |
| fastapi | 0.115.14 | MIT License (classifier) | https://github.com/fastapi/fastapi | planner/requirements.txt |
| h11 | 0.16.0 | MIT | https://github.com/python-hyper/h11 | uvicorn |
| httptools | 0.9.0 | MIT | https://github.com/MagicStack/httptools | uvicorn |
| idna | 3.20 | BSD-3-Clause | https://github.com/kjd/idna | anyio |
| networkx | 3.4.2 | BSD License (classifier) | https://networkx.org/ | planner/requirements.txt |
| pydantic | 2.13.5 | MIT | https://github.com/pydantic/pydantic | fastapi |
| pydantic_core | 2.46.5 | MIT | https://github.com/pydantic/pydantic | pydantic |
| python-dotenv | 1.2.3 | BSD-3-Clause | https://github.com/theskumar/python-dotenv | uvicorn |
| PyYAML | 6.0.3 | MIT | https://pyyaml.org/ | uvicorn |
| starlette | 0.46.2 | BSD-3-Clause | https://github.com/encode/starlette | fastapi |
| typing_extensions | 4.16.0 | PSF-2.0 | https://github.com/python/typing_extensions | anyio, fastapi, pydantic, pydantic_core, typing-inspection |
| typing-inspection | 0.4.4 | MIT | https://github.com/pydantic/typing-inspection | pydantic |
| uvicorn[standard] | 0.32.1 | BSD-3-Clause | https://www.uvicorn.org/ | planner/requirements.txt |
| uvloop | 0.23.0 | MIT License | https://github.com/MagicStack/uvloop | uvicorn |
| watchfiles | 1.3.0 | MIT | https://github.com/samuelcolvin/watchfiles | uvicorn |
| websockets | 17.4 | BSD-3-Clause | https://github.com/python-websockets/websockets | uvicorn |

[//]: # (python:end)

## Not from a package manager

Listed by hand in `docs/third-party.manual.json`.

### AI Elements components

- Version or tag: as fetched from https://elements.ai-sdk.dev/api/registry on 2026-11-20
- Licence: Apache-2.0
- How it is used: copied source
- Origin: Vercel's AI Elements registry, written into this repository by the shadcn CLI
- Changes: None. The files are as the CLI wrote them.
- Referenced in: `src/components/ai-elements/conversation.tsx`, `src/components/ai-elements/inline-citation.tsx`, `src/components/ai-elements/message.tsx`, `src/components/ai-elements/prompt-input.tsx`, `src/components/ai-elements/shimmer.tsx`, `src/components/ai-elements/sources.tsx`, `src/components/ai-elements/suggestion.tsx`
- Source: https://github.com/vercel/ai-elements
- Licence evidence: https://raw.githubusercontent.com/vercel/ai-elements/main/LICENSE, read 20 November 2026: 'Copyright 2023 Vercel, Inc. Licensed under the Apache License, Version 2.0'.

### Inter (typeface)

- Version or tag: Fontsource metadata version v20 (2025-09-10), as packaged in @fontsource-variable/inter 5.3.0
- Licence: OFL-1.1
- How it is used: font files
- Referenced in: `src/app/globals.css`
- Source: https://github.com/rsms/inter
- Licence evidence: node_modules/@fontsource-variable/inter/LICENSE: 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) ... This Font Software is licensed under the SIL Open Font License, Version 1.1.'; metadata.json license.type OFL-1.1.
- Notes: The font files are copied unmodified into the built CSS assets and served to the browser.

### JetBrains Mono (typeface)

- Version or tag: Fontsource metadata version v24 (2025-09-11), as packaged in @fontsource-variable/jetbrains-mono 5.3.0
- Licence: OFL-1.1
- How it is used: font files
- Referenced in: `src/app/globals.css`
- Source: https://github.com/JetBrains/JetBrainsMono
- Licence evidence: node_modules/@fontsource-variable/jetbrains-mono/LICENSE: 'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) ... This Font Software is licensed under the SIL Open Font License, Version 1.1.'; metadata.json license.type OFL-1.1.
- Notes: The font files are copied unmodified into the built CSS assets and served to the browser.

### Node.js (official Docker image node)

- Version or tag: 22-bookworm-slim
- Licence: MIT (Node.js; its LICENSE also lists bundled libraries under their own licences); image build files MIT (nodejs/docker-node); the image also contains Debian bookworm packages under their own licences
- How it is used: container image
- Referenced in: `Dockerfile`
- Source: https://github.com/nodejs/docker-node
- Licence evidence: Node.js LICENSE (https://github.com/nodejs/node/blob/main/LICENSE, and the same file in a Node 22 install) opens 'Node.js is licensed for use as follows:' followed by the MIT text and a list of externally maintained libraries; nodejs/docker-node LICENSE is MIT, 'Copyright (c) 2015 Joyent, Inc.'
- Notes: Build and run stages of the web app image.

### pgvector (Docker image pgvector/pgvector)

- Version or tag: 0.8.7-pg19-trixie (default; PG_IMAGE may override it)
- Licence: PostgreSQL
- How it is used: container image
- Referenced in: `docker-compose.yml`
- Source: https://github.com/pgvector/pgvector
- Licence evidence: pgvector LICENSE (https://github.com/pgvector/pgvector/blob/master/LICENSE): 'Portions Copyright (c) 1996-2026, PostgreSQL Global Development Group ... Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted', the PostgreSQL Licence text. pgvector's Dockerfile builds FROM postgres:$PG_MAJOR-$DEBIAN_CODENAME, so the image also contains the PostgreSQL entry below and Debian trixie packages under their own licences.
- Notes: The db service. The extension is loaded by the database server; the web app talks to it over the network.

### pgvector (Docker image pgvector/pgvector, CI only)

- Version or tag: pg17
- Licence: PostgreSQL
- How it is used: container image
- Referenced in: `.github/workflows/ci.yml`
- Source: https://github.com/pgvector/pgvector
- Licence evidence: Same project and licence file as the pgvector entry above.
- Notes: Database service for the test job in GitHub Actions; not part of what is shipped.

### PostgreSQL

- Version or tag: 19 (inside pgvector/pgvector:0.8.7-pg19-trixie)
- Licence: PostgreSQL
- How it is used: separate process
- Referenced in: `docker-compose.yml`
- Source: https://www.postgresql.org
- Licence evidence: https://www.postgresql.org/about/license: 'PostgreSQL is released under the PostgreSQL License, a liberal Open Source license, similar to the BSD or MIT licenses.' The licence of the official postgres image's build files (docker-library/postgres) was not read.
- Notes: Runs as its own container; the web app connects to it over the network through the pg client library.

### Python (official Docker image python)

- Version or tag: 3.13-slim
- Licence: PSF-2.0 (Python); image build files unverified; the image also contains Debian packages under their own licences
- How it is used: container image
- Referenced in: `planner/Dockerfile`
- Source: https://hub.docker.com/_/python
- Licence evidence: Python's LICENSE.txt (in a Python 3.13 install) contains 'PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2'; the image's Docker Hub page points to that licence information for Python 3 and states the image contains other software under other licences. The licence of the docker-library/python build files could not be read (GitHub rate limit) and is unverified.
- Notes: Base image of the planner service.

### shadcn/ui components added by its CLI

- Version or tag: as fetched by `npx shadcn@latest add` on 2026-11-20
- Licence: MIT
- How it is used: copied source
- Origin: https://ui.shadcn.com registry, written into this repository by the shadcn CLI
- Changes: None. The files are as the CLI wrote them; colours come from the theme variables in src/app/globals.css.
- Referenced in: `src/components/ui/alert.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button-group.tsx`, `src/components/ui/carousel.tsx`, `src/components/ui/collapsible.tsx`, `src/components/ui/command.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/hover-card.tsx`, `src/components/ui/input-group.tsx`, `src/components/ui/label.tsx`, `src/components/ui/scroll-area.tsx`, `src/components/ui/select.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/sonner.tsx`, `src/components/ui/spinner.tsx`, `src/components/ui/switch.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/tooltip.tsx`
- Source: https://github.com/shadcn-ui/ui
- Licence evidence: https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md, read 20 November 2026: 'MIT License. Copyright (c) 2023 shadcn'.

### UI components (Button, Dialog, Input, Table, Card, StatusBadge)

- Version or tag: as committed in eb362b6 (2026-11-20)
- Licence: owner's own work (Planet9V/eigenia); four files follow shadcn/ui's structure (MIT)
- How it is used: copied source
- Origin: Planet9V/eigenia, the owner's own project (owner's statement, 20 November 2026)
- Changes: Re-themed to Eigenia design tokens (per the file headers). On 20 November 2026 button.tsx gained the variant and size names shadcn/ui components pass, and dialog.tsx gained DialogHeader.
- Referenced in: `src/components/ui/button.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/input.tsx`, `src/components/ui/table.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/StatusBadge.tsx`
- Source: https://github.com/shadcn-ui/ui
- Licence evidence: The owner stated on 20 November 2026 that all six components come from Eigenia, his own project (Planet9V/eigenia). button.tsx, dialog.tsx, input.tsx and table.tsx describe themselves as 'shadcn/ui ... themed to Eigenia's design tokens'; shadcn/ui is published under the MIT License ('Copyright (c) 2023 shadcn', https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). Card.tsx and StatusBadge.tsx carry no third-party note.
