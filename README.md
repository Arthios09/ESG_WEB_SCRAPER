# ESG PDF URL Scraper

A Node.js application that finds and extracts ESG (Environmental, Social, and Governance) report PDF URLs from company websites using Puppeteer.

## Features

- 🔍 **Automated PDF Discovery**: Finds ESG-related PDF reports on company websites
- 📅 **Year Range Filtering**: Search for PDFs within specific year ranges
- 🚀 **High Performance**: Uses Puppeteer with optimized settings
- 📊 **Structured Output**: Saves results in JSON format with metadata
- 🛡️ **Anti-Detection**: Implements measures to avoid being blocked

## Installation

```bash
git clone <repository-url>
cd esg-scraper
npm install
```

## Usage

### Basic Usage

Search for a single year:
```bash
node index.js "Company Name" 2024
```

Search for a year range:
```bash
node index.js "Company Name" 2022 2025
```

### Examples

```bash
# Search Boeing ESG reports from 2022-2025
node index.js "Boeing" 2022 2025

# Search Apple ESG reports from 2024 only
node index.js "Apple Inc" 2024

# Search Microsoft ESG reports from 2023-2024
node index.js "Microsoft Corporation" 2023 2024
```

## Output

The scraper generates `esg-pdf-urls.json` containing:
- Company name
- Source URL
- Array of found PDF links with metadata (URL, text, title)

## Configuration

The scraper runs in headless mode by default. To see the browser:
- Edit `index.js` and change `headless: true` to `headless: false`

## Legal Notice

Always respect website terms of service and robots.txt files when scraping. Use scraped data responsibly and in compliance with applicable laws. 