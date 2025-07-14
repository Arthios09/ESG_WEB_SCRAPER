# ESG Report Scraper

A Node.js application to scrape ESG (Environmental, Social, and Governance) report information using Puppeteer. This tool helps researchers, analysts, and investors gather ESG data from various company reports and websites.

## Features

- 🔍 **Automated ESG Data Extraction**: Scrapes ESG-related information from company websites and reports
- 📄 **PDF Processing**: Downloads and extracts text from ESG-related PDF reports
- 🔢 **Text Chunking**: Splits PDF text into manageable chunks for vector database ingestion
- 📊 **Structured Data Output**: Organizes data into Environmental, Social, and Governance categories
- 🚀 **High Performance**: Uses Puppeteer with optimized settings for fast scraping
- 📝 **Comprehensive Reporting**: Generates detailed reports of scraped data
- 💾 **Multiple Export Formats**: Saves results in JSON, JSONL, and structured formats
- 🛡️ **Anti-Detection**: Implements measures to avoid being blocked by websites
- ⚙️ **Configurable**: Easy to customize for different use cases

## Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd esg-scraper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up configuration** (optional)
   ```bash
   cp config.example.js config.js
   # Edit config.js with your preferred settings
   ```

## Usage

### Basic Usage

Run the scraper with default settings:

```bash
npm start
```

### Quick Start (PDF Processing)

Test PDF processing with a single company:

```bash
npm run quick
```

### Test PDF Processing

Test PDF download and text extraction:

```bash
npm run test-pdf
```

### Development Mode

Run with file watching for development:

```bash
npm run dev
```

### Custom Configuration

1. Copy the example configuration:
   ```bash
   cp config.example.js config.js
   ```

2. Edit `config.js` to customize:
   - Company list to scrape
   - Browser settings
   - Scraping parameters
   - Output options

3. Run with custom configuration:
   ```bash
   node index.js
   ```

## Configuration Options

### Browser Settings
- `headless`: Run browser in headless mode (true/false)
- `viewport`: Browser window size
- `args`: Additional Chrome arguments for performance

### Scraping Settings
- `requestDelay`: Delay between requests (milliseconds)
- `pageTimeout`: Page load timeout (milliseconds)
- `maxResultsPerCompany`: Maximum search results to process

### ESG Keywords
Customize the keywords used to identify ESG-related content:
- Environmental: carbon, emissions, energy, waste, water
- Social: diversity, workforce, community, safety
- Governance: board, ethics, compliance, transparency

## Output Format

The scraper generates multiple output files:

### 1. Main Results (JSON)
```json
[
  {
    "company": "Apple Inc",
    "source": "Apple Environmental Progress Report",
    "url": "https://www.apple.com/environment/",
    "data": {
      "environmental": {
        "carbonFootprint": "Found carbon-related data",
        "energy": "Found energy-related data"
      },
      "social": {
        "diversity": "Found diversity-related data"
      },
      "governance": {
        "transparency": "Found transparency-related data"
      },
      "general": {
        "title": "Page Title",
        "company": "Apple Inc",
        "url": "https://www.apple.com/environment/",
        "tables": 3
      },
      "pdfs": [
        {
          "url": "https://example.com/report.pdf",
          "text": "Download ESG Report",
          "isPDF": true
        }
      ]
    },
    "scrapedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

### 2. PDF Chunks (JSONL) - For Vector Database
```jsonl
{"id":"apple_inc_esg_report_chunk_0","company":"Apple Inc","source_url":"https://example.com/report.pdf","pdf_filename":"apple_inc_esg_report.pdf","chunk_index":0,"text":"This is the extracted text from the PDF...","text_length":1500,"start_sentence":0,"end_sentence":15,"esg_keywords":{"environmental":{"carbon":["carbon","emissions"]},"social":{},"governance":{}},"created_at":"2024-01-15T10:30:00.000Z"}
{"id":"apple_inc_esg_report_chunk_1","company":"Apple Inc","source_url":"https://example.com/report.pdf","pdf_filename":"apple_inc_esg_report.pdf","chunk_index":1,"text":"Next chunk of text...","text_length":1800,"start_sentence":16,"end_sentence":32,"esg_keywords":{"environmental":{},"social":{"diversity":["diversity","inclusion"]},"governance":{}},"created_at":"2024-01-15T10:30:00.000Z"}
```

### 3. PDF Metadata (JSON)
```json
{
  "summary": {
    "total_pdfs": 5,
    "total_chunks": 150,
    "companies": ["Apple Inc", "Microsoft Corporation"],
    "processed_at": "2024-01-15T10:30:00.000Z"
  },
  "pdfs": [
    {
      "metadata": {
        "company": "Apple Inc",
        "source_url": "https://example.com/report.pdf",
        "pdf_filename": "apple_inc_esg_report.pdf",
        "total_pages": 45,
        "total_chunks": 30,
        "total_text_length": 25000,
        "esg_keywords": {
          "environmental": {
            "carbon": ["carbon", "emissions", "co2"],
            "energy": ["energy", "renewable"]
          }
        }
      }
    }
  ]
}
```

## Customization

### Adding New Companies

Edit the `companies` array in `config.js`:

```javascript
companies: [
    'Your Company Name',
    'Another Company Inc',
    // Add more companies here
]
```

### Custom Search Sources

Add custom search URLs for specific companies:

```javascript
const scraper = new ESGScraper();
await scraper.scrapeCompanyESG('Company Name', 'https://custom-search-url.com');
```

### Extending ESG Metrics

Modify the `extractESGData` method in `index.js` to add new ESG metrics:

```javascript
// Add new environmental metrics
if (text.includes('biodiversity')) {
    data.environmental.biodiversity = 'Found biodiversity data';
}
```

## Best Practices

### Rate Limiting
- The scraper includes built-in delays between requests
- Adjust `requestDelay` in config to be respectful to websites
- Consider using longer delays for production use

### Error Handling
- The scraper gracefully handles errors and continues processing
- Failed scrapes are logged but don't stop the entire process
- Check console output for any issues

### Legal Considerations
- Always respect robots.txt files
- Check website terms of service before scraping
- Use scraped data responsibly and in compliance with applicable laws
- Consider reaching out to companies for official ESG data when available

## Troubleshooting

### Common Issues

1. **Browser won't start**
   - Ensure you have sufficient system resources
   - Try running in headless mode: `headless: true`

2. **No results found**
   - Check if the company names are correct
   - Verify internet connection
   - Some websites may block automated access

3. **Slow performance**
   - Reduce `maxResultsPerCompany` in config
   - Increase `requestDelay` to be more respectful
   - Run in headless mode for better performance

### Debug Mode

Enable debug logging by modifying the console.log statements or adding:

```javascript
// Add to index.js for more detailed logging
process.env.DEBUG = 'puppeteer:*';
```

## Dependencies

- **puppeteer**: Browser automation
- **cheerio**: HTML parsing (for future enhancements)
- **axios**: HTTP requests (for future enhancements)
- **dotenv**: Environment variable management

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Disclaimer

This tool is for educational and research purposes. Users are responsible for ensuring compliance with website terms of service and applicable laws when scraping data. Always be respectful of website resources and consider reaching out to companies for official ESG data when available. 