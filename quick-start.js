#!/usr/bin/env node

const ESGScraper = require('./index.js');

async function quickStart() {
    console.log('🚀 ESG Scraper - Quick Start');
    console.log('='.repeat(40));
    
    const scraper = new ESGScraper();
    
    try {
        // Initialize the scraper
        console.log('📡 Initializing browser...');
        await scraper.initialize();
        
        // Scrape a single company as a demo
        console.log('\n🔍 Scraping ESG data for Apple Inc...');
        await scraper.scrapeCompanyESG('Apple Inc');
        
        // Also try a company known to have ESG PDFs
        console.log('\n🔍 Scraping ESG data for Patagonia (known for ESG reports)...');
        await scraper.scrapeCompanyESG('Patagonia');
        
        // Generate a simple report
        console.log('\n📊 Generating report...');
        await scraper.generateReport();
        
        // Save results
        console.log('\n💾 Saving results...');
        await scraper.saveResults('quick-start-results.json');
        
        console.log('\n✅ Quick start completed successfully!');
        console.log('📁 Check quick-start-results.json for the scraped data');
        
    } catch (error) {
        console.error('❌ Quick start error:', error.message);
        console.log('\n💡 Try running: npm start for the full example');
    } finally {
        await scraper.close();
    }
}

// Run quick start if this file is executed directly
if (require.main === module) {
    quickStart().catch(console.error);
}

module.exports = quickStart; 