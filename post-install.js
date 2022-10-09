const fs = require("fs");
const path = require("path");

let file1 = fs.readFileSync(
  "node_modules/@noir-lang/noir_wasm/noir_wasm.js",
  "utf-8"
);

file1 = file1.replace("import.meta.url", "");
fs.writeFileSync("node_modules/@noir-lang/noir_wasm/noir_wasm.js", file1);

let file2 = fs.readFileSync(
  "node_modules/@noir-lang/aztec_backend/aztec_backend.js",
  "utf-8"
);
file2 = file2.replace("import.meta.url", "");
fs.writeFileSync(
  "node_modules/@noir-lang/aztec_backend/aztec_backend.js",
  file2
);