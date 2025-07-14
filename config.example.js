// ESG Scraper Configuration
// Copy this file to config.js and modify as needed

module.exports = {
    // Browser settings
    browser: {
        headless: false, // Set to true for production
        viewport: {
            width: 1920,
            height: 1080
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    },

    // Scraping settings
    scraping: {
        requestDelay: 2000, // Delay between requests in milliseconds
        pageTimeout: 30000, // Page load timeout in milliseconds
        maxResultsPerCompany: 5, // Maximum search results to process per company
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },

    // ESG keywords for filtering
    esgKeywords: [
        'esg', 'environmental', 'social', 'governance', 'sustainability',
        'csr', 'corporate social responsibility', 'impact report',
        'sustainability report', 'esg report', 'annual report',
        'climate', 'carbon', 'emissions', 'renewable', 'energy',
        'diversity', 'inclusion', 'workforce', 'community',
        'ethics', 'compliance', 'transparency', 'board'
    ],

    // Output settings
    output: {
        filename: 'esg-results.json',
        saveScreenshots: false,
        screenshotPath: './screenshots'
    },

    // Example companies to scrape
    companies: [
        'Apple Inc',
        'Microsoft Corporation',
        'Tesla Inc',
        'Amazon.com Inc',
        'Alphabet Inc',
        'Meta Platforms Inc',
        'NVIDIA Corporation',
        'Netflix Inc',
        'Salesforce Inc',
        'Adobe Inc'
    ],

    // Search engines and sources
    searchSources: {
        google: 'https://www.google.com/search?q=',
        bing: 'https://www.bing.com/search?q=',
        duckduckgo: 'https://duckduckgo.com/?q='
    }
}; 