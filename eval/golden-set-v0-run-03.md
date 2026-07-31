# Golden set — Working Prototype v0

- Run: `golden-set-v0-run-03`
- Thời gian: 2026-07-31T07:40:24.906Z → 2026-07-31T07:41:39.326Z
- Đích test: `POST /api/chat` tại http://127.0.0.1:4198
- Bộ case: `eval/golden-set.md` (27 case)
- Kết quả HTTP: **27/27** request trả 200.
- Phân bố route: `invalid-page`: 1, `slide`: 22, `insufficient`: 3, `irrelevant`: 1.

## Lưu ý phạm vi

Golden set được viết cho hợp đồng `CP3-test/final_answer`. Bản v0 dùng hợp đồng `route/answer/citations` và không nhận `selection`; runner chỉ gửi `question` và `currentPage`. Vì vậy báo cáo này là kết quả thực thi/API, không tự gán đạt-không đạt theo rubric CP3.

## Kết quả từng case

| ID | HTTP | Route | Citation slide | Thời gian (ms) |
| --- | ---: | --- | --- | ---: |
| C01 | 200 | invalid-page | - | 11 |
| C02 | 200 | slide | 15 | 3369 |
| C03 | 200 | slide | 27, 14, 19, 26 | 4438 |
| C13 | 200 | slide | 18, 4, 3, 21, 24, 1, 2 | 1840 |
| C04 | 200 | insufficient | - | 5 |
| C05 | 200 | insufficient | - | 5 |
| C06 | 200 | slide | 16 | 4730 |
| C14 | 200 | insufficient | - | 5 |
| C07 | 200 | irrelevant | - | 2721 |
| C08 | 200 | slide | 10, 8, 3, 21, 12, 14, 26 | 2686 |
| C09 | 200 | slide | 29, 19, 22, 11, 18, 23, 6 | 2726 |
| C10 | 200 | slide | 22, 28, 19, 14 | 4757 |
| C11 | 200 | slide | 29, 26, 3, 2, 14, 20, 28 | 2173 |
| C12 | 200 | slide | 17 | 2567 |
| N01 | 200 | slide | 4, 28 | 2789 |
| N02 | 200 | slide | 10, 8, 3, 21, 19 | 2570 |
| N03 | 200 | slide | 13, 19, 18, 28, 27 | 2841 |
| N04 | 200 | slide | 14, 27, 26, 11, 18 | 2932 |
| N05 | 200 | slide | 19 | 4281 |
| N06 | 200 | slide | 14, 19, 28, 20, 5, 26, 18 | 3161 |
| N07 | 200 | slide | 21 | 2309 |
| N08 | 200 | slide | 10, 21, 3, 28, 8, 11, 26, 17, 16, 19 | 3901 |
| N09 | 200 | slide | 4, 23, 5, 8 | 3434 |
| N10 | 200 | slide | 20, 1, 15, 25, 13, 23, 14 | 3091 |
| R01 | 200 | slide | 8, 11, 15, 20 | 4714 |
| R02 | 200 | slide | 21 | 2932 |
| R03 | 200 | slide | 16, 27, 15, 28, 11, 2, 14 | 3133 |

Raw response đầy đủ: `golden-set-v0-run-03-raw.json`.
