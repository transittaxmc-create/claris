# Tax Reference 2026 — Island City Transit / Copiloto

## Official IRS forms (2026)
- Schedule C: https://www.irs.gov/pub/irs-pdf/f1040sc.pdf
- Schedule SE: https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
- Form 1040: https://www.irs.gov/pub/irs-pdf/f1040.pdf
- Form 1040-ES (estimated): https://www.irs.gov/pub/irs-pdf/f1040es.pdf
- Form 8995 (QBI): https://www.irs.gov/pub/irs-pdf/f8995.pdf

## Key 2026 rates
- Mileage H1 (Jan–Jun): $0.725/mile
- Mileage H2 (Jul–Dec): $0.76/mile
- SE tax: 15.3%
- Social Security wage base: $184,500
- QBI deduction: 20%
- Section 179 limit: $2,560,000

## Data flow in the app
1. Trips (TODAY/EARNINGS) → Schedule C line 1 (gross receipts)
2. Platform fees → Schedule C line 10
3. Business expenses → Schedule C lines by category
4. Tolls/parking → Schedule C line 9
5. Net profit → Schedule SE (self-employment tax)
6. ½ SE tax → Schedule 1 deduction
7. QBI → Form 8995

## Vehicle methods
- Standard mileage: rate × miles + tolls/parking
- Actual: fuel + maintenance + wash + insurance + lease + tolls + parking

## Notes
- Only business-classified expenses count
- Personal expenses are excluded
- Outstanding receivables are not income until received
- A CPA must review before filing
