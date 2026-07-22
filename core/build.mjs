// build.mjs - bundle demo.ts (CLI) với esbuild cho `pnpm start:built`. Import
// extensionless (moduleResolution "Bundler") không được Node ESM tự resolve, nên dist/
// phải là bundle, không phải file rời. Core không còn barrel index.ts -> không export
// package "@simai-chain/core" nữa; explorer nạp thẳng từng file trong src/** qua alias
// @core (xem explorer/vite.config.ts), nên chỉ cần bundle mỗi demo.ts ở đây.
import { build } from "esbuild";

const external = ["@noble/curves/*", "@noble/hashes/*"];

await build({
  entryPoints: ["demo.ts"],
  outfile: "dist/demo.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  external,
});
