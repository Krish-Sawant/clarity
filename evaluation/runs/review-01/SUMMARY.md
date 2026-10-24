# AI-reviewed explanation quality

Not customer comprehension or UI testing. Single judge; exploratory results.

Judge: gemini-3.5-flash-lite. Same-model judge: true.

Completed pairs: 9/12. Skipped: 3.

| Criterion | A mean / 2 (n) | B mean / 2 (n) |
| --- | --- | --- |
| correctness | 1.22 (9) | 1.89 (9) |
| clarity | 1.11 (9) | 1.44 (9) |
| relevance | 1.56 (9) | 1.89 (9) |
| causeAndEffect | 1.00 (6) | 1.71 (7) |
| limitations | 1.22 (9) | 1.33 (9) |
| nextStepUsefulness | 0.33 (9) | 0.89 (9) |

Do not combine correctness and presentation into one quality score. Inspect review.json for quotes, rationale, and suggested improvements. These automated ratings require human spot-checking before use in a presentation.

## Unscored pairs

Both candidates are excluded together to keep comparisons paired. Missing scores are not zeros. Invalid judge output is a review failure, not a failure of the evaluated bot.

- partial-projection: Invalid AI review; paired scores excluded pending human review
- explain-apr: Invalid AI review; paired scores excluded pending human review
- unsupported-event: Invalid AI review; paired scores excluded pending human review