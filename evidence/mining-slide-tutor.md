# Mining evidence — citation của VLearn Tutor

Nguồn duy nhất của phép đo này là data pack ẩn danh cục bộ: `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv`. File CSV không được sao chép, đẩy lên repo công khai, hoặc đưa nguyên văn vào prompt bên ngoài phạm vi hackathon.

## Câu hỏi đo

Trong các lượt Tutor, bao nhiêu lượt không trả citation, và trong nhóm đó bao nhiêu lượt đang giải thích/ôn khái niệm (`review_concept`)?

## Cách tái lập

Chạy từ root repository, với Python 3. Không ghi file và không gọi mạng:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
@'
import csv
from collections import Counter

path = 'data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv'
with open(path, encoding='utf-8-sig', newline='') as handle:
    rows = list(csv.DictReader(handle))

tutor = [row for row in rows if row['role'].strip().lower() == 'tutor']
without_citation = [
    row for row in tutor
    if row['citations'].strip() in {'', '[]', 'null', 'None'}
]

print('tutor turns:', len(tutor))
print('without citations:', len(without_citation))
print('affected users:', len({row['user_id'] for row in without_citation if row['user_id']}))
print('affected conversations:', len({row['conversation_id'] for row in without_citation if row['conversation_id']}))
print('moves:', Counter(row['move_used'] for row in without_citation).most_common())
'@ | python -
```

## Kết quả quan sát

| Chỉ số | Giá trị |
| --- | ---: |
| Lượt `role=tutor` | 1.261 |
| Lượt `citations` rỗng hoặc `[]` | 582 |
| Tỷ lệ không citation | 46,2% |
| User có ít nhất một lượt không citation | 255 |
| Hội thoại có ít nhất một lượt không citation | 339 |
| `review_concept` trong nhóm không citation | 448 (77,0%) |

### Năm ví dụ kiểm tra thủ công

Chỉ dùng turn ID và câu hỏi ngắn để giảm lộ dữ liệu. Khi cần audit, mở CSV cục bộ và tìm cặp `turn_id` có `role=student`/`role=tutor`.

| Turn | Câu hỏi học viên (rút gọn) | Quan sát Tutor có thể kiểm tra |
| --- | --- | --- |
| T0020 | “Giải thích đoạn bôi đen ở Trang 15.” | `review_concept`, `citations=[]` |
| T0769 | “giải thích nghĩa chi tiết của trang 4” | `review_concept`, `citations=[]` |
| T0524 | “bạn đọc được nội dung slide ko, giải thích slide 44” | `review_concept`, `citations=[]` |
| T0436 | “Giải thích slide 35” | `review_concept`, `citations=[]` |
| T1261 | “giải thích kỹ cơ chế transformer” | `review_concept`, `citations=[]` |

## Diễn giải và giới hạn

Kết quả chứng minh citation vắng mặt thường xuyên trong dữ liệu đã cấp, đặc biệt ở nhóm giải thích khái niệm. Nó **không** đo thời gian tiết kiệm, độ hiểu bài, sự hài lòng, hay quan hệ nhân quả. Những outcome này chỉ được ghi sau user validation thật trong `validation/feedback-log.md`.
