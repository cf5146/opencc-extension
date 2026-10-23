# Bundled third-party notices

The extension application code retains the original Tony Chan copyright and [MIT license](../LICENSE.txt), included in the packaged extension. The bundled conversion engine/data have their own licenses.

- OpenCC core/configuration/dictionaries, ver.1.4.2 commit 025f371dc76b598d77384fbdab90c937471844d8: Apache-2.0; see notices/OpenCC/LICENSE.
- cppjieba and its bundled model/resources from that same official source: MIT; see notices/OpenCC/plugins/jieba/deps/cppjieba/LICENSE.
- marisa0.3.1 and darts-clone0.32h: see their original COPYING.md under notices/OpenCC/deps.
- RapidJSON1.1.0: notices/RapidJSON-1.1.0-license.txt, retained from https://raw.githubusercontent.com/Tencent/rapidjson/v1.1.0/license.txt. This includes the component's third-party notices.
- Emscripten4.0.22 runtime and system libraries: notices/Emscripten-LICENSE and original notices under notices/Emscripten/system. The notice set includes SDK components conservatively and does not assert that every listed component is linked.

OpenCC's original sources are unchanged; the local adapter replaces plugin discovery and exposes a length-aware heap boundary. See scripts/opencc-feasibility in the source repository for source/tool pins and rebuilding instructions.

No native Node addon, npm package, Python interpreter, compiler, or SDK is distributed in the extension. Those are development/reference tools only.
