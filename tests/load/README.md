# Chatbot Load Test

Script dùng [k6](https://k6.io) để đo performance của endpoint streaming.

## Cài k6

```bash
# Windows (Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Chạy test

```bash
# Mặc định: ramp 50→200 VUs, hold 3 phút
k6 run tests/load/chatbot-load.js

# Tùy chỉnh base URL
k6 run -e BASE_URL=http://localhost:5000 tests/load/chatbot-load.js

# Tùy chỉnh message + ramp nhanh
k6 run -e TEST_MESSAGE="áo sơ mi" --duration 1m --vus 50 tests/load/chatbot-load.js

# Xuất JSON metrics
k6 run --out json=result.json tests/load/chatbot-load.js
```

## Acceptance criteria

| Metric | Target |
|---|---|
| p95 latency | < 5s |
| p99 latency | < 10s |
| Error rate | < 1% |
| Throughput | ≥ 50 req/s sustained |

## Lưu ý

- Test chạy với server thật (MISTRAL_API_KEY cần set).
- Nếu Mistral rate limit → test fail, scale down VUs.
- Nên warm up: chạy 1 phút trước khi đo (script có sẵn).
- Không chạy production load test khi chưa có plan rollback.
