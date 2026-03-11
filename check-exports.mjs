import { createRequire } from "module";
const require = createRequire(import.meta.url);
const b = require("@whiskeysockets/baileys");
console.log("default export type:", typeof b.default);
console.log("makeWASocket type:", typeof b.makeWASocket);
console.log("Has default?", !!b.default);
console.log("default === makeWASocket?", b.default === b.makeWASocket);

// Check if defaultQueryTimeoutMs = 0 causes issues
console.log("\n--- Testing with defaultQueryTimeoutMs = 0 ---");
console.log("typeof 0:", typeof 0);
console.log("0 is falsy:", !0);
console.log("undefined is falsy:", !undefined);
