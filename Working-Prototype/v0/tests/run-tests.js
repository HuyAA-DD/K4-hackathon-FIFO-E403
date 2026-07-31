const assert = require("node:assert/strict");

const { routeQuestion, parsePageSelection } = require("../src/chat-policy");
const { searchPages, searchSlidesByPrompt } = require("../src/retrieval");

const pages = Array.from({ length: 29 }, (_, index) => ({
  page: index + 1,
  title: `Trang ${index + 1}`,
  text: "Nội dung bài giảng.",
  keywords: []
}));
pages[0] = { page: 1, title: "Nhập môn", text: "Bài giảng giới thiệu trí tuệ nhân tạo.", keywords: ["trí tuệ", "nhân tạo"] };
pages[14] = { page: 15, title: "Attention", text: "Attention cho phép mô hình tập trung vào token liên quan.", keywords: ["attention", "token"] };
pages[16] = { page: 17, title: "Tham số", text: "GPT-3 là mô hình dense; MoE chỉ kích hoạt một số chuyên gia.", keywords: ["dense", "moe", "tham số"] };

function run(name, callback) {
  callback();
  console.log(`PASS ${name}`);
}

run("page selection understands ranges and ignores a single page reference", () => {
  assert.deepEqual(parsePageSelection("tóm tắt slide 15 đến 17", pages).pages.map((page) => page.page), [15, 16, 17]);
  assert.equal(parsePageSelection("slide 44", pages), null);
});

run("retrieval prioritizes a page matching all terms", () => {
  const results = searchSlidesByPrompt("attention token", pages);
  assert.equal(results[0].page, 15);
  assert.equal(results[0].matchType, "all-terms");
  assert.equal(searchPages("mô hình dense", pages)[0].page, 17);
});

run("policy keeps unrelated and deictic questions in safe routes", () => {
  const unrelated = routeQuestion({ question: "Thời tiết hôm nay thế nào?", currentPage: 1, pages, searchPages });
  assert.equal(unrelated.route, "irrelevant");

  const currentPage = routeQuestion({ question: "Giải thích slide này", currentPage: 15, pages, searchPages });
  assert.equal(currentPage.route, "slide");
  assert.deepEqual(currentPage.results.map((page) => page.page), [15]);
});

console.log("All policy and retrieval tests passed.");
