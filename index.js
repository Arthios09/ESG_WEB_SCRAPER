const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const PDFProcessor = require('./pdfProcessor');
require('dotenv').config();

class ESGScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = [];
        this.pdfProcessor = new PDFProcessor();
        this.pdfResults = [];
    }

    async initialize() {
        console.log('🚀 Initializing ESG Scraper...');
        
        // Launch browser with specific options for better performance
        this.browser = await puppeteer.launch({
            headless: true, // Set to true for production
            defaultViewport: { width: 1920, height: 1080 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Enable request interception for better performance
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('✅ Browser initialized successfully');
    }

    async scrapeCompanyESG(companyName, searchUrl = null) {
        try {
            console.log(`🔍 Scraping ESG data for: ${companyName}`);
            
            let url = searchUrl;
            let usedEngine = 'google';
            if (!url) {
                // Default to Google search for ESG reports
                url = `https://www.google.com/search?q=${encodeURIComponent(companyName + ' ESG report sustainability')}`;
            }

            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // DEBUG: Output the raw HTML of the search results page
            const rawHTML = await this.page.content();
            await fs.writeFile(`debug_search_results_${usedEngine}.html`, rawHTML);
            console.log(`📝 Saved raw HTML of search results to debug_search_results_${usedEngine}.html`);
            
            // Wait for search results to load (try multiple selectors)
            let searchResults = [];
            let foundLinks = [];
            try {
                // Try different Google search result selectors
                const selectors = [
                    'div.g',
                    'div[data-sokoban-container]',
                    'div[jscontroller]',
                    'a[href]:not([href*="google.com"])'
                ];
                
                let foundSelector = false;
                for (const selector of selectors) {
                    try {
                        await this.page.waitForSelector(selector, { timeout: 5000 });
                        foundSelector = true;
                        break;
                    } catch (e) {
                        continue;
                    }
                }
                
                if (!foundSelector) {
                    // If no specific selector found, wait for any content
                    await this.page.waitForTimeout(3000);
                }
                
                // Extract search results with more flexible selectors
                const evalResults = await this.page.evaluate(() => {
                    const results = [];
                    const foundLinks = [];
                    // Try multiple approaches to find search results
                    const selectors = [
                        'div.g a[href]',
                        'div[data-sokoban-container] a[href]',
                        'div[jscontroller] a[href]',
                        'a[href]:not([href*="google.com"]):not([href*="youtube.com"])'
                    ];
                    
                    for (const selector of selectors) {
                        const links = document.querySelectorAll(selector);
                        if (links.length > 0) {
                            links.forEach(link => {
                                const href = link.href;
                                const title = link.querySelector('h3')?.textContent || 
                                            link.querySelector('div')?.textContent || 
                                            link.textContent || '';
                                const snippet = link.closest('div')?.querySelector('div')?.textContent || '';
                                foundLinks.push({ href, title });
                                if (href && title && !href.includes('google.com') && !href.includes('youtube.com')) {
                                    results.push({
                                        title: title.trim(),
                                        url: href,
                                        snippet: snippet.trim()
                                    });
                                }
                            });
                            break; // Use first successful selector
                        }
                    }
                    // DEBUG: Return all found links for logging
                    return { results: results.slice(0, 5), foundLinks };
                });
                foundLinks = evalResults.foundLinks || [];
                searchResults = evalResults.results || [];
            } catch (error) {
                console.log(`⚠️  Could not extract search results: ${error.message}`);
                // Fallback: create a simple result for testing
                searchResults = [{
                    title: 'ESG Report Search',
                    url: url,
                    snippet: 'Search results could not be extracted'
                }];
            }

            // DEBUG: Log all found links
            console.log('🔗 All found links on search page:');
            foundLinks.forEach((l, i) => console.log(`${i + 1}. ${l.title} -> ${l.href}`));

            // Fallback to Bing if no results found
            if (searchResults.length === 0 && !searchUrl) {
                console.log('🔄 No results from Google, trying Bing...');
                usedEngine = 'bing';
                url = `https://www.bing.com/search?q=${encodeURIComponent(companyName + ' ESG report sustainability')}`;
                await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                const rawHTMLBing = await this.page.content();
                await fs.writeFile(`debug_search_results_${usedEngine}.html`, rawHTMLBing);
                console.log(`📝 Saved raw HTML of Bing search results to debug_search_results_${usedEngine}.html`);
                // Try to extract links from Bing
                searchResults = await this.page.evaluate(() => {
                    const results = [];
                    const links = document.querySelectorAll('li.b_algo h2 a');
                    links.forEach(link => {
                        const href = link.href;
                        const title = link.textContent || '';
                        const snippet = link.closest('li.b_algo')?.querySelector('.b_caption p')?.textContent || '';
                        if (href && title) {
                            results.push({
                                title: title.trim(),
                                url: href,
                                snippet: snippet.trim()
                            });
                        }
                    });
                    return results.slice(0, 5);
                });
                console.log('🔗 Bing found links:');
                searchResults.forEach((l, i) => console.log(`${i + 1}. ${l.title} -> ${l.url}`));
            }

            console.log(`📊 Found ${searchResults.length} potential ESG sources`);

            // Process each result to find ESG reports
            for (const result of searchResults) {
                if (this.isESGRelated(result.title, result.snippet)) {
                    const esgData = await this.extractESGData(result.url, companyName);
                    if (esgData) {
                        this.results.push({
                            company: companyName,
                            source: result.title,
                            url: result.url,
                            data: esgData,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                }
            }

        } catch (error) {
            console.error(`❌ Error scraping ${companyName}:`, error.message);
        }
    }

    isESGRelated(title, snippet) {
        const esgKeywords = [
            'esg', 'environmental', 'social', 'governance', 'sustainability',
            'csr', 'corporate social responsibility', 'impact report',
            'sustainability report', 'esg report', 'annual report'
        ];
        
        const text = (title + ' ' + snippet).toLowerCase();
        return esgKeywords.some(keyword => text.includes(keyword));
    }

    async extractESGData(url, companyName) {
        try {
            console.log(`📄 Extracting data from: ${url}`);
            
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait a bit for dynamic content to load
            await this.page.waitForTimeout(3000);
            
            // First, look for PDFs on this page
            const pdfLinks = await this.findPDFLinks(url, companyName);
            
            // Extract ESG-related data from the page content
            const esgData = await this.page.evaluate((company) => {
                const data = {
                    environmental: {},
                    social: {},
                    governance: {},
                    general: {}
                };

                // Look for common ESG metrics and data
                const text = document.body.innerText.toLowerCase();
                
                // Environmental metrics
                if (text.includes('carbon') || text.includes('emissions')) {
                    data.environmental.carbonFootprint = 'Found carbon-related data';
                }
                if (text.includes('energy') || text.includes('renewable')) {
                    data.environmental.energy = 'Found energy-related data';
                }
                if (text.includes('waste') || text.includes('recycling')) {
                    data.environmental.waste = 'Found waste-related data';
                }
                if (text.includes('water')) {
                    data.environmental.water = 'Found water-related data';
                }

                // Social metrics
                if (text.includes('diversity') || text.includes('inclusion')) {
                    data.social.diversity = 'Found diversity-related data';
                }
                if (text.includes('employee') || text.includes('workforce')) {
                    data.social.workforce = 'Found workforce-related data';
                }
                if (text.includes('community') || text.includes('philanthropy')) {
                    data.social.community = 'Found community-related data';
                }
                if (text.includes('safety') || text.includes('health')) {
                    data.social.safety = 'Found safety-related data';
                }

                // Governance metrics
                if (text.includes('board') || text.includes('director')) {
                    data.governance.board = 'Found board-related data';
                }
                if (text.includes('ethics') || text.includes('compliance')) {
                    data.governance.ethics = 'Found ethics-related data';
                }
                if (text.includes('transparency') || text.includes('disclosure')) {
                    data.governance.transparency = 'Found transparency-related data';
                }

                // General ESG information
                data.general.title = document.title;
                data.general.company = company;
                data.general.url = window.location.href;
                
                // Extract any tables or structured data
                const tables = document.querySelectorAll('table');
                if (tables.length > 0) {
                    data.general.tables = tables.length;
                }

                return data;
            }, companyName);

            // Add PDF information to the data
            esgData.pdfs = pdfLinks;

            return esgData;

        } catch (error) {
            console.error(`❌ Error extracting data from ${url}:`, error.message);
            return null;
        }
    }

    async findPDFLinks(url, companyName) {
        try {
            console.log(`🔍 Looking for PDFs on: ${url}`);
            const pdfLinks = await this.page.evaluate(() => {
                const links = [];
                const allLinks = document.querySelectorAll('a[href]');
                allLinks.forEach(link => {
                    const href = link.href.toLowerCase();
                    const text = link.textContent.toLowerCase();
                    // Check if it's a PDF link
                    if (href.includes('.pdf') || 
                        text.includes('pdf') || 
                        text.includes('download') ||
                        text.includes('report') ||
                        text.includes('esg') ||
                        text.includes('sustainability') ||
                        text.includes('environmental') ||
                        text.includes('social') ||
                        text.includes('governance')) { //ADD MORE KEYWORDS HERE (CONFLICT, EMPLOYEE, SOCIETY)
                        links.push({
                            url: link.href,
                            text: link.textContent.trim(),
                            title: link.title || ''
                        });
                    }
                });
                return links;
            });
            console.log(`📎 Found ${pdfLinks.length} potential PDF links`);
            // Only return the found links, do not process or download
            return pdfLinks;
        } catch (error) {
            console.error(`❌ Error finding PDFs on ${url}:`, error.message);
            return [];
        }
    }

    // Remove processPDFLink and all PDF processing logic

    generateSafeFilename(companyName, linkText, url) {
        // Clean company name
        const cleanCompany = companyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        
        // Clean link text
        const cleanText = linkText.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().substring(0, 50);
        
        // Extract filename from URL if possible
        const urlParts = url.split('/');
        const urlFilename = urlParts[urlParts.length - 1];
        
        let filename = cleanText;
        if (urlFilename && urlFilename.includes('.pdf')) {
            filename = urlFilename;
        } else {
            filename = `${cleanText}.pdf`;
        }
        
        // Ensure it's a PDF
        if (!filename.endsWith('.pdf')) {
            filename += '.pdf';
        }
        
        return `${cleanCompany}_${filename}`;
    }

    async scrapeMultipleCompanies(companies) {
        console.log(`🎯 Starting to scrape ${companies.length} companies...`);
        
        for (const company of companies) {
            await this.scrapeCompanyESG(company);
            // Add delay between requests to be respectful
            await this.page.waitForTimeout(2000);
        }
    }

    async saveResults(filename = 'esg-pdf-urls.json') {
        try {
            const pdfUrlResults = this.results.map(result => ({
                company: result.company,
                source: result.source,
                url: result.url,
                pdf_links: result.pdfs || []
            }));
            const filepath = path.join(process.cwd(), filename);
            await fs.writeFile(filepath, JSON.stringify(pdfUrlResults, null, 2));
            console.log(`💾 PDF URL results saved to: ${filepath}`);
        } catch (error) {
            console.error('❌ Error saving PDF URL results:', error.message);
        }
    }

    async generateReport() {
        if (this.results.length === 0) {
            console.log('📝 No results to generate report for');
            return;
        }

        console.log('\n📊 ESG Scraping Report');
        console.log('='.repeat(50));
        console.log(`Total companies processed: ${this.results.length}`);
        
        this.results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.company}`);
            console.log(`   Source: ${result.source}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Environmental metrics: ${Object.keys(result.data.environmental).length}`);
            console.log(`   Social metrics: ${Object.keys(result.data.social).length}`);
            console.log(`   Governance metrics: ${Object.keys(result.data.governance).length}`);
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
        
        // Clean up downloaded PDFs (optional - comment out if you want to keep them)
        // await this.pdfProcessor.cleanupDownloads();
    }
}

// Main execution function
async function main() {
    // Parse runtime arguments
    const args = process.argv.slice(2);
    const companyArg = args[0] || 'Boeing';
    const startYear = args[1] ? parseInt(args[1], 10) : null;
    const stopYear = args[2] ? parseInt(args[2], 10) : null;
    let yearsToInclude = [];
    if (startYear && stopYear) {
        // Inclusive range
        for (let y = startYear; y <= stopYear; y++) {
            yearsToInclude.push(y.toString());
        }
    } else if (startYear) {
        yearsToInclude = [startYear.toString()];
    } else {
        // Default: current year
        yearsToInclude = [new Date().getFullYear().toString()];
    }

    const scraper = new ESGScraper();
    try {
        await scraper.initialize();
        // Only one company at a time, from args
        const companies = [companyArg];
        // Scrape ESG for the company
        for (const company of companies) {
            await scraper.scrapeCompanyESG(company);
        }
        // Filter PDF links in results to only include those with a year in yearsToInclude
        scraper.results.forEach(result => {
            if (result.pdfs) {
                result.pdfs = result.pdfs.filter(pdf => {
                    return yearsToInclude.some(year => pdf.url.includes(year) || pdf.text.includes(year) || pdf.title.includes(year));
                });
            }
        });
        await scraper.generateReport();
        await scraper.saveResults();
    } catch (error) {
        console.error('❌ Main execution error:', error);
    } finally {
        await scraper.close();
    }
}

// Run the scraper if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ESGScraper; 