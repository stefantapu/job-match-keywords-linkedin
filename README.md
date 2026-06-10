# LinkedIn Job Match Keywords

Compact Chrome extension for LinkedIn Jobs. It adds a right-side page widget that compares the open job description against positive and negative keyword lists.

## Test install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `C:\Users\filim\Documents\job match keywords linkedin`.
5. Open a LinkedIn Jobs page, for example `https://www.linkedin.com/jobs/search/`.

## Behavior

- Runs only on `https://www.linkedin.com/jobs/*`.
- Stores keywords in `chrome.storage.sync`.
- Uses comma-separated keywords only.
- Supports three keyword groups: `Very positive`, `Positive`, and `Negative`.
- Uses weighted scoring instead of dividing matches by the full keyword list size.
- Shows repeated occurrences as `keyword xN`.
- Reads only the job description, primarily from `#job-details`.
- Auto rescans when LinkedIn changes the selected job and includes manual `Rescan job`.
- Popup includes `Rescan job` and `Restart widget`.

## Scoring

The percentage is a directional signal, not a final decision:

- each found `Very positive` keyword adds strong positive weight;
- each found `Positive` keyword adds smaller positive weight;
- each found `Negative` keyword subtracts a soft penalty;
- missing keywords are shown for context but do not directly lower the score.
