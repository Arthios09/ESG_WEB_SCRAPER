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
        
        // Launch browser with realistic settings to avoid detection
        this.browser = await puppeteer.launch({
            headless: true, // Set to true for production
            defaultViewport: { width: 1366, height: 768 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-field-trial-config',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-client-side-phishing-detection',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--mute-audio',
                '--no-default-browser-check',
                '--safebrowsing-disable-auto-update',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set realistic user agent
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set additional headers to look more realistic
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        
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
            
            // Direct approach: try common ESG/sustainability URLs for the company
            const potentialUrls = this.generateESGUrls(companyName);
            
            for (const url of potentialUrls) {
                try {
                    console.log(`🔍 Trying: ${url}`);
                    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
                    
                    // Check if page loaded successfully and is not an error page
                    const pageTitle = await this.page.title();
                    const pageContent = await this.page.content();
                    
                    if (this.isValidPage(pageTitle, pageContent)) {
                        console.log(`✅ Found working page: ${pageTitle}`);
                        
                        // Extract data from this page
                        const esgData = await this.extractESGData(url, companyName);
                        
                        if (esgData && esgData.pdfs && esgData.pdfs.length > 0) {
                            this.results.push({
                                company: companyName,
                                source: pageTitle,
                                url: url,
                                data: esgData,
                                pdfs: esgData.pdfs || [],
                                scrapedAt: new Date().toISOString()
                            });
                            console.log(`📄 Found ${esgData.pdfs.length} PDFs on ${url}`);
                        }
                        
                        // Also check for subpages that might contain PDFs (like reporting-disclosures)
                        if (esgData && esgData.pdfs) {
                            const subpageLinks = esgData.pdfs.filter(link => 
                                link.text.toLowerCase().includes('reporting') ||
                                link.text.toLowerCase().includes('disclosure') ||
                                link.text.toLowerCase().includes('download') ||
                                link.text.toLowerCase().includes('reports')
                            );
                            
                            for (const subpageLink of subpageLinks.slice(0, 3)) { // Limit to 3 subpages
                                try {
                                    console.log(`🔍 Following subpage: ${subpageLink.text} -> ${subpageLink.url}`);
                                    await this.page.goto(subpageLink.url, { waitUntil: 'networkidle2', timeout: 15000 });
                                    
                                    const subpageTitle = await this.page.title();
                                    const subpageContent = await this.page.content();
                                    
                                    if (this.isValidPage(subpageTitle, subpageContent)) {
                                        console.log(`✅ Found working subpage: ${subpageTitle}`);
                                        
                                        const subpageData = await this.extractESGData(subpageLink.url, companyName);
                                        
                                        if (subpageData && subpageData.pdfs && subpageData.pdfs.length > 0) {
                                            this.results.push({
                                                company: companyName,
                                                source: subpageTitle,
                                                url: subpageLink.url,
                                                data: subpageData,
                                                pdfs: subpageData.pdfs || [],
                                                scrapedAt: new Date().toISOString()
                                            });
                                            console.log(`📄 Found ${subpageData.pdfs.length} PDFs on subpage ${subpageLink.url}`);
                                        }
                                    }
                                } catch (error) {
                                    console.log(`⚠️  Could not access subpage ${subpageLink.url}: ${error.message}`);
                                    continue;
                                }
                            }
                        }
                    } else {
                        console.log(`❌ Page not found or invalid: ${pageTitle}`);
                    }
                } catch (error) {
                    console.log(`⚠️  Could not access ${url}: ${error.message}`);
                    continue;
                }
            }

        } catch (error) {
            console.error(`❌ Error scraping ${companyName}:`, error.message);
        }
    }

        generateESGUrls(companyName) {
        // Clean company name for URL generation
        const cleanName = companyName.toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .replace(/\s+/g, '');
        
        // Handle multi-word company names (e.g., "Energy Recovery" -> "energyrecovery")
        const words = companyName.toLowerCase().split(/\s+/);
        const singleWordName = words.join('');
        const hyphenatedName = words.join('-');
        const underscoreName = words.join('_');
        
        // Common ESG/sustainability URL patterns with multiple name variations
        const basePatterns = [
            // Standard patterns with cleaned name
            `https://www.${cleanName}.com/sustainability`,
            `https://www.${cleanName}.com/esg`,
            `https://www.${cleanName}.com/environmental`,
            `https://www.${cleanName}.com/corporate-responsibility`,
            `https://www.${cleanName}.com/responsibility`,
            `https://www.${cleanName}.com/impact`,
            `https://www.${cleanName}.com/about/sustainability`,
            `https://www.${cleanName}.com/about/esg`,
            `https://www.${cleanName}.com/investors/sustainability`,
            `https://www.${cleanName}.com/investors/esg`,
            `https://investors.${cleanName}.com/sustainability`,
            `https://investors.${cleanName}.com/esg`,
            `https://sustainability.${cleanName}.com`,
            `https://esg.${cleanName}.com`,
            
            // Patterns with single word name (for multi-word companies)
            `https://www.${singleWordName}.com/sustainability`,
            `https://www.${singleWordName}.com/esg`,
            `https://www.${singleWordName}.com/environmental`,
            `https://www.${singleWordName}.com/corporate-responsibility`,
            `https://www.${singleWordName}.com/responsibility`,
            `https://www.${singleWordName}.com/impact`,
            `https://www.${singleWordName}.com/about/sustainability`,
            `https://www.${singleWordName}.com/about/esg`,
            `https://www.${singleWordName}.com/investors/sustainability`,
            `https://www.${singleWordName}.com/investors/esg`,
            `https://investors.${singleWordName}.com/sustainability`,
            `https://investors.${singleWordName}.com/esg`,
            `https://sustainability.${singleWordName}.com`,
            `https://esg.${singleWordName}.com`,
            
            // Patterns with hyphenated name
            `https://www.${hyphenatedName}.com/sustainability`,
            `https://www.${hyphenatedName}.com/esg`,
            `https://www.${hyphenatedName}.com/environmental`,
            `https://www.${hyphenatedName}.com/corporate-responsibility`,
            `https://www.${hyphenatedName}.com/responsibility`,
            `https://www.${hyphenatedName}.com/impact`,
            `https://www.${hyphenatedName}.com/about/sustainability`,
            `https://www.${hyphenatedName}.com/about/esg`,
            `https://www.${hyphenatedName}.com/investors/sustainability`,
            `https://www.${hyphenatedName}.com/investors/esg`,
            `https://investors.${hyphenatedName}.com/sustainability`,
            `https://investors.${hyphenatedName}.com/esg`,
            `https://sustainability.${hyphenatedName}.com`,
            `https://esg.${hyphenatedName}.com`,
            
            // Additional common patterns
            `https://${cleanName}.com/sustainability`,
            `https://${cleanName}.com/esg`,
            `https://${cleanName}.com/environmental`,
            `https://${cleanName}.com/corporate-responsibility`,
            `https://${cleanName}.com/responsibility`,
            `https://${cleanName}.com/impact`,
            `https://${cleanName}.com/about/sustainability`,
            `https://${cleanName}.com/about/esg`,
            `https://${cleanName}.com/investors/sustainability`,
            `https://${cleanName}.com/investors/esg`,
            
            // Without www prefix
            `https://${singleWordName}.com/sustainability`,
            `https://${singleWordName}.com/esg`,
            `https://${singleWordName}.com/environmental`,
            `https://${singleWordName}.com/corporate-responsibility`,
            `https://${singleWordName}.com/responsibility`,
            `https://${singleWordName}.com/impact`,
            `https://${singleWordName}.com/about/sustainability`,
            `https://${singleWordName}.com/about/esg`,
            `https://${singleWordName}.com/investors/sustainability`,
            `https://${singleWordName}.com/investors/esg`,
            
            `https://${hyphenatedName}.com/sustainability`,
            `https://${hyphenatedName}.com/esg`,
            `https://${hyphenatedName}.com/environmental`,
            `https://${hyphenatedName}.com/corporate-responsibility`,
            `https://${hyphenatedName}.com/responsibility`,
            `https://${hyphenatedName}.com/impact`,
            `https://${hyphenatedName}.com/about/sustainability`,
            `https://${hyphenatedName}.com/about/esg`,
            `https://${hyphenatedName}.com/investors/sustainability`,
            `https://${hyphenatedName}.com/investors/esg`
        ];
        
        // Add some variations for common company names
        const variations = [];
        if (companyName.toLowerCase().includes('boeing')) {
            variations.push(
                'https://www.boeing.com/sustainability',
                'https://www.boeing.com/about/sustainability',
                'https://www.boeing.com/company/sustainability'
            );
        } else if (companyName.toLowerCase().includes('apple')) {
            variations.push(
                'https://www.apple.com/environment',
                'https://www.apple.com/supplier-responsibility',
                'https://www.apple.com/accessibility'
            );
        } else if (companyName.toLowerCase().includes('microsoft')) {
            variations.push(
                'https://www.microsoft.com/en-us/corporate-responsibility',
                'https://www.microsoft.com/en-us/sustainability',
                'https://www.microsoft.com/en-us/accessibility'
            );
        }
        
        return [...variations, ...basePatterns];
    }

    isESGRelated(title, snippet) {
        const esgKeywords = [
            'esg', 'environmental', 'social', 'governance', 'sustainability',
            'csr', 'corporate social responsibility', 'impact report',
            'sustainability report', 'esg report', 'annual report', 'Sustainability'
        ];
        
        const text = (title + ' ' + snippet).toLowerCase();
        return esgKeywords.some(keyword => text.includes(keyword));
    }

    //IGNORE NO LONGER USED
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

            // PDF INFO --> DATA
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
            
            // First, let's see ALL links on the page for debugging
            const allPageLinks = await this.page.evaluate(() => {
                const links = [];
                const allLinks = document.querySelectorAll('a[href]');
                
                allLinks.forEach(link => {
                    links.push({
                        url: link.href,
                        text: link.textContent.trim(),
                        title: link.title || '',
                        className: link.className,
                        id: link.id
                    });
                });
                
                return links;
            });
            
            console.log(`🔗 Total links found on page: ${allPageLinks.length}`);
            
            // Now look for PDF links with improved detection
            const pdfLinks = await this.page.evaluate(() => {
                const links = [];
                const allLinks = document.querySelectorAll('a[href]');
                
                allLinks.forEach(link => {
                    const href = link.href.toLowerCase();
                    const text = link.textContent.toLowerCase().trim();
                    const title = (link.title || '').toLowerCase();
                    const className = link.className.toLowerCase();
                    const id = link.id.toLowerCase();
                    
                    // Check for direct PDF links
                    const isDirectPdf = href.includes('.pdf') || href.endsWith('.pdf');
                    
                    // Check for download links (broader criteria)
                    const isDownloadLink = text.includes('download') || 
                                         title.includes('download') ||
                                         className.includes('download') ||
                                         id.includes('download') ||
                                         text.includes('get') ||
                                         text.includes('view') ||
                                         text.includes('open') ||
                                         text.includes('access');
                    
                    // Check for report links (broader criteria)
                    const isReportLink = text.includes('report') || 
                                       title.includes('report') ||
                                       text.includes('sustainability') ||
                                       title.includes('sustainability') ||
                                       text.includes('esg') ||
                                       title.includes('esg') ||
                                       text.includes('performance') ||
                                       text.includes('summary') ||
                                       text.includes('disclosure') ||
                                       text.includes('statement') ||
                                       text.includes('document') ||
                                       text.includes('publication');
                    
                    // Check for button-like links that might be PDFs
                    const isButtonLink = className.includes('btn') ||
                                       className.includes('button') ||
                                       id.includes('btn') ||
                                       id.includes('button') ||
                                       text.length < 20; // Short text often indicates buttons
                    
                    // Check for links that might be PDFs (more focused criteria)
                    const mightBePdf = isDirectPdf || 
                                     (isDownloadLink && (text.includes('pdf') || href.includes('pdf'))) || 
                                     (isReportLink && (text.includes('pdf') || href.includes('pdf') || text.includes('download'))) ||
                                     (isButtonLink && (text.includes('pdf') || href.includes('pdf') || text.includes('download'))) ||
                                     text.includes('pdf') ||
                                     title.includes('pdf') ||
                                     className.includes('pdf') ||
                                     id.includes('pdf') ||
                                     href.includes('pdf');
                    
                    if (mightBePdf) {
                        links.push({
                            url: link.href,
                            text: link.textContent.trim(),
                            title: link.title || '',
                            className: link.className,
                            id: link.id,
                            isDirectPdf: isDirectPdf,
                            isDownloadLink: isDownloadLink,
                            isReportLink: isReportLink,
                            isButtonLink: isButtonLink
                        });
                    }
                });
                
                return links;
            });
            
            console.log(`📎 Found ${pdfLinks.length} potential PDF links:`);
            pdfLinks.forEach((link, index) => {
                console.log(`  ${index + 1}. "${link.text}" -> ${link.url}`);
                console.log(`     Class: ${link.className}, ID: ${link.id}`);
                console.log(`     Direct: ${link.isDirectPdf}, Download: ${link.isDownloadLink}, Report: ${link.isReportLink}, Button: ${link.isButtonLink}`);
            });
            
            // Also show some non-PDF links for debugging
            const nonPdfLinks = allPageLinks.filter(link => 
                !pdfLinks.some(pdfLink => pdfLink.url === link.url)
            ).slice(0, 10); // Show first 10 non-PDF links
            
            console.log(`🔗 Sample of other links on page:`);
            nonPdfLinks.forEach((link, index) => {
                console.log(`  ${index + 1}. "${link.text}" -> ${link.url}`);
            });
            
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
        
        // Extract FILE_NAME
        const urlParts = url.split('/');
        const urlFilename = urlParts[urlParts.length - 1];
        
        let filename = cleanText;
        if (urlFilename && urlFilename.includes('.pdf')) {
            filename = urlFilename;
        } else {
            filename = `${cleanText}.pdf`;
        }
        
        // MAKE SURE ITS A PDF
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

    isValidPage(pageTitle, pageContent) {
        // Check for common error indicators
        const errorIndicators = [
            '404', 'not found', 'page not found', 'error', 'does not exist',
            'page unavailable', 'access denied', 'forbidden', 'unauthorized',
            'server error', 'internal server error', 'service unavailable'
        ];
        
        const titleLower = pageTitle.toLowerCase();
        const contentLower = pageContent.toLowerCase();
        
        // Check if any error indicators are present in title or prominent content
        for (const indicator of errorIndicators) {
            if (titleLower.includes(indicator)) {
                return false;
            }
        }
        
        // Check for error indicators in the first part of the content (more reliable)
        const firstPart = contentLower.substring(0, 2000);
        for (const indicator of errorIndicators) {
            if (firstPart.includes(indicator)) {
                return false;
            }
        }
        
        // Check if page has meaningful content (not just a blank page)
        const hasContent = pageContent.length > 500; // Reduced minimum content length
        const hasLinks = pageContent.includes('<a href');
        const hasBodyContent = pageContent.includes('<body') && pageContent.includes('</body>');
        
        return hasContent && hasLinks && hasBodyContent;
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
        // Log summary of found PDFs before filtering
        let totalPdfsFound = 0;
        scraper.results.forEach((result, idx) => {
            if (result.pdfs && result.pdfs.length > 0) {
                totalPdfsFound += result.pdfs.length;
                console.log(`📄 Found ${result.pdfs.length} PDFs on ${result.url}`);
            }
        });
        console.log(`📊 Total PDFs found before filtering: ${totalPdfsFound}`);
        console.log(`🔍 Filtering for years: ${yearsToInclude.join(', ')}`);

        // Filter PDF links in results to only include those with a year in yearsToInclude
        scraper.results.forEach(result => {
            if (result.pdfs) {
                result.pdfs = result.pdfs.filter(pdf => {
                    return yearsToInclude.some(year => {
                        // Check URL/filename for year
                        const urlLower = pdf.url.toLowerCase();
                        const textLower = pdf.text.toLowerCase();
                        
                        // Check for year in URL path, filename, or as part of .pdf filename
                        if (urlLower.includes(`/${year}/`) || 
                            urlLower.includes(`_${year}`) || 
                            urlLower.includes(`${year}.pdf`) ||
                            urlLower.includes(`-${year}.pdf`) ||
                            urlLower.includes(`_${year}_`) ||
                            urlLower.includes(`-${year}-`) ||
                            urlLower.includes(`${year}-`) ||
                            urlLower.includes(`-${year}`) ||
                            urlLower.includes(`${year}`) ||
                            textLower.includes(year)) {
                            return true;
                        }
                        
                        return false;
                    });
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