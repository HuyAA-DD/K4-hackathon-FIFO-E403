import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/tutor/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

assert.match(route, /memoryMatchesCurrentSlide/);
assert.match(route, /documentId === body\.documentId/);
assert.match(route, /pageNumber === body\.slide\.id/);
assert.match(route, /PDF_TEXT_LAYER_WORDS/);
assert.match(route, /input_image/);
assert.match(route, /mode: liveMode \? "live" : "demo"/);

assert.match(page, /localOcrText/);
assert.match(page, /localOcrWords/);
assert.match(page, /\/api\/tutor/);

console.log("PASS Lumi source contract: page-scoped memory and tutor route are present.");
