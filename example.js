const ESGScraper = require('./index.js');

async function runExample() {
    const scraper = new ESGScraper();
    
    try {
        console.log('🎯 Starting ESG Scraper Example...');
        
        await scraper.initialize();
        
        // Example 1: Scrape specific companies
        const techCompanies = [
            'Apple Inc',
            'Microsoft Corporation',
            'Tesla Inc'
        ];
        
        console.log('\n📊 Scraping tech companies...');
        await scraper.scrapeMultipleCompanies(techCompanies);
        
        // Example 2: Scrape a single company with custom search
        console.log('\n🔍 Scraping specific company with custom search...');
        await scraper.scrapeCompanyESG(
            'Nike Inc',
            'https://www.google.com/search?q=Nike+sustainability+report+ESG'
        );
        
        // Example 3: Scrape companies from different sectors
        const diverseCompanies = [
            'Coca-Cola Company',
            'Walmart Inc',
            'Johnson & Johnson'
        ];
        
        console.log('\n🏭 Scraping diverse sector companies...');
        await scraper.scrapeMultipleCompanies(diverseCompanies);
        
        // Generate and save results
        await scraper.generateReport();
        await scraper.saveResults('example-results.json');
        
        console.log('\n✅ Example completed successfully!');
        
    } catch (error) {
        console.error('❌ Example error:', error);
    } finally {
        await scraper.close();
    }
}

// Example of custom ESG scraper with specific configuration
class CustomESGScraper extends ESGScraper {
    constructor() {
        super();
        this.customKeywords = [
            'climate change',
            'renewable energy',
            'carbon neutral',
            'sustainable development',
            'green technology'
        ];
    }
    
    async extractESGData(url, companyName) {
        try {
            console.log(`🔬 Custom extraction from: ${url}`);
            
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.page.waitForTimeout(3000);
            
            // Custom extraction logic
            const customData = await this.page.evaluate((company, keywords) => {
                const data = {
                    environmental: {},
                    social: {},
                    governance: {},
                    custom: {},
                    general: {}
                };
                
                const text = document.body.innerText.toLowerCase();
                
                // Check for custom keywords
                keywords.forEach(keyword => {
                    if (text.includes(keyword.toLowerCase())) {
                        data.custom[keyword] = 'Found custom keyword data';
                    }
                });
                
                // Extract specific ESG metrics
                const metrics = {
                    'carbon emissions': /(\d+(?:\.\d+)?)\s*(?:tons?|t)\s*(?:of\s*)?(?:co2?|carbon)/gi,
                    'renewable energy': /(\d+(?:\.\d+)?)\s*%/gi,
                    'water usage': /(\d+(?:\.\d+)?)\s*(?:gallons?|liters?|m3)/gi
                };
                
                Object.entries(metrics).forEach(([metric, regex]) => {
                    const matches = text.match(regex);
                    if (matches) {
                        data.environmental[metric] = matches.slice(0, 3); // Store first 3 matches
                    }
                });
                
                // Extract tables with ESG data
                const tables = document.querySelectorAll('table');
                data.general.tableCount = tables.length;
                
                // Look for specific ESG sections
                const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                headings.forEach(heading => {
                    const headingText = heading.textContent.toLowerCase();
                    if (headingText.includes('environmental') || headingText.includes('climate')) {
                        data.environmental.sections = data.environmental.sections || [];
                        data.environmental.sections.push(heading.textContent.trim());
                    }
                    if (headingText.includes('social') || headingText.includes('diversity')) {
                        data.social.sections = data.social.sections || [];
                        data.social.sections.push(heading.textContent.trim());
                    }
                    if (headingText.includes('governance') || headingText.includes('board')) {
                        data.governance.sections = data.governance.sections || [];
                        data.governance.sections.push(heading.textContent.trim());
                    }
                });
                
                data.general.title = document.title;
                data.general.company = company;
                data.general.url = window.location.href;
                
                return data;
            }, companyName, this.customKeywords);
            
            return customData;
            
        } catch (error) {
            console.error(`❌ Custom extraction error from ${url}:`, error.message);
            return null;
        }
    }
}

async function runCustomExample() {
    const customScraper = new CustomESGScraper();
    
    try {
        console.log('\n🚀 Starting Custom ESG Scraper Example...');
        
        await customScraper.initialize();
        
        const companies = [
            'Patagonia',
            'Unilever',
            'Interface Inc'
        ];
        
        await customScraper.scrapeMultipleCompanies(companies);
        await customScraper.generateReport();
        await customScraper.saveResults('custom-results.json');
        
        console.log('\n✅ Custom example completed!');
        
    } catch (error) {
        console.error('❌ Custom example error:', error);
    } finally {
        await customScraper.close();
    }
}

// Run examples if this file is executed directly
if (require.main === module) {
    console.log('🎯 ESG Scraper Examples');
    console.log('='.repeat(50));
    
    // Run basic example
    runExample()
        .then(() => {
            console.log('\n' + '='.repeat(50));
            // Run custom example
            return runCustomExample();
        })
        .then(() => {
            console.log('\n🎉 All examples completed!');
        })
        .catch(console.error);
}

module.exports = { runExample, runCustomExample, CustomESGScraper }; 