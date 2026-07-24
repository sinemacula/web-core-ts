# Changelog

## 1.0.0 (2026-07-24)


### Features

* absorb the application composition root and session lifecycle into the kernel ([#5](https://github.com/sinemacula/web-core-ts/issues/5)) ([3c8552c](https://github.com/sinemacula/web-core-ts/commit/3c8552c16f397d1a59fe5a3d3172587342699fc7))
* **build:** generate static HTTP error pages ([#31](https://github.com/sinemacula/web-core-ts/issues/31)) ([1b93e35](https://github.com/sinemacula/web-core-ts/commit/1b93e354ee64c4e22f7081b280753d748fcba596))
* enforce the module contract with a shipped eslint preset ([#11](https://github.com/sinemacula/web-core-ts/issues/11)) ([4259e7c](https://github.com/sinemacula/web-core-ts/commit/4259e7ca469e2a734f2e698bc0b22fa36ac0720d))
* harden the ESLint preset, adopt reusable CI, and conform to coding-standards v1.11.0 ([#12](https://github.com/sinemacula/web-core-ts/issues/12)) ([25e53ab](https://github.com/sinemacula/web-core-ts/commit/25e53abdf1d8604fb82794f4c2ddeab29ad58e90))
* import the framework kernel, playground harness and quality gates ([#1](https://github.com/sinemacula/web-core-ts/issues/1)) ([00d0a99](https://github.com/sinemacula/web-core-ts/commit/00d0a99741bba51dcdbdaf21a77d3db6cf0057ed))
* publish the kernel to npm with a release-please pipeline ([#8](https://github.com/sinemacula/web-core-ts/issues/8)) ([8bfba8d](https://github.com/sinemacula/web-core-ts/commit/8bfba8d73db44a38f272c5b72e8faff1df99b154))
* **theme:** add light/dark/system colour-scheme support ([#28](https://github.com/sinemacula/web-core-ts/issues/28)) ([e156482](https://github.com/sinemacula/web-core-ts/commit/e156482f6026e1564a10bf7ba7ec7e127e372548))


### Bug Fixes

* **build:** disable source maps and pin the browser target ([#27](https://github.com/sinemacula/web-core-ts/issues/27)) ([e90d21c](https://github.com/sinemacula/web-core-ts/commit/e90d21cb91d64cb7e35ffb15b7559991e9a2d988))
* **deps:** bump brace-expansion to the patched 5.0.7 ([#29](https://github.com/sinemacula/web-core-ts/issues/29)) ([b7e3354](https://github.com/sinemacula/web-core-ts/commit/b7e3354a944be9455bdc109f8da18c7127b7172d))
* **deps:** bump fast-uri to the patched 3.1.3 ([#37](https://github.com/sinemacula/web-core-ts/issues/37)) ([23aedf4](https://github.com/sinemacula/web-core-ts/commit/23aedf46bc38a2616180f88916de4b663f81b60b))
* **qlty:** install dependencies before type-aware ESLint on Cloud ([#41](https://github.com/sinemacula/web-core-ts/issues/41)) ([bbc2823](https://github.com/sinemacula/web-core-ts/commit/bbc282376c87a3673b08295e60d8b4bbc444ce9b))
* **qlty:** tighten the Cloud eslint install to npm ci ([#43](https://github.com/sinemacula/web-core-ts/issues/43)) ([67daa1e](https://github.com/sinemacula/web-core-ts/commit/67daa1e2107c163ac6ed6671219ab8f35e44e62c))
* **session:** make authorize() await the user load, with new e2e coverage ([#18](https://github.com/sinemacula/web-core-ts/issues/18)) ([df0d389](https://github.com/sinemacula/web-core-ts/commit/df0d389f0a6c07121aad188356fa36c1d2a10dcb))
