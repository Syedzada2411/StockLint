# StockLint

**Know what is wrong with an inventory CSV before the next upload.** StockLint is an open-source, local-first quality checker for small sellers and operations teams. It reads a CSV in the browser, maps four required columns, flags problems, and exports a reviewed CSV plus a change log. It does not connect to a store, send data to a server, or silently guess a correction.

**Status:** working early preview (v0.1). Built by Syed Areeb Ali as a self-initiated project. The sample file is fictional. No client deployment, live platform integration, or proven business outcome is claimed.

## Try it

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000> and choose **Load fictional sample inventory**, or select your own `.csv` file. No installation or build step. Modern browser required. All processing happens in that tab; there are no external scripts, fonts, analytics, or network requests after loading local project files.

The required columns are **SKU**, **product name**, **stock quantity**, and **unit price**. Match each to a CSV header in the app. Additional columns are preserved. Upload limit: 5 MB or 20,000 data rows. The demo has intentionally messy rows, including a duplicate SKU and invalid values.

## What it checks

- Missing SKU or name; duplicate SKUs, case-insensitive after trimming surrounding spaces.
- Stock must be a non-negative whole number; price must be non-negative with at most two decimal places. These are generic rules, not platform-specific import requirements.
- Uneven column counts; these block reviewed CSV export so data is not silently lost. The audit report can still be downloaded.
- Leading and trailing whitespace in the four mapped fields; this is the only automatic modification and every change is logged.

The reviewed CSV **retains unresolved issues**. Always inspect its audit log and verify values with your source of truth before importing it into another system. CSV exports prefix formula-like text with an apostrophe to reduce spreadsheet formula execution; this safety prefix can affect values that begin with `=`, `+`, `-`, or `@`. This is a generic review tool, not a certified upload-ready format for Lightspeed, Shopify, or any other vendor. It does not import files into those services.

## Run tests

```bash
npm test
```

The tests cover quoted CSV parsing, duplicate detection, malformed rows, and spreadsheet-formula export safety. Node.js 20+ is recommended. No package install needed.

## Roadmap and support

Read [ROADMAP.md](ROADMAP.md) for specific next milestones and [SUPPORT.md](SUPPORT.md) for ways to help. Funding is intended to pay for development, documentation, accessibility, and testing with opt-in sample data. No donation channel is advertised until the maintainer has a verified way to accept funds.

## Contributing

Bug reports and pull requests are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md). Do not include real customer inventory in public issues. See [SECURITY.md](SECURITY.md) for responsible reports.

MIT licensed; see [LICENSE](LICENSE).
