const PDFProcessor = require('./pdfProcessor');

async function testPDFProcessing() {
    console.log('🧪 Testing PDF Processing...');
    
    const processor = new PDFProcessor();
    
    try {
        // Test with a sample ESG report PDF (using a publicly available PDF)
        const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        const filename = 'test_apple_esg_report.pdf';
        const companyName = 'Apple Inc';
        
        console.log(`📥 Testing with: ${testUrl}`);
        
        const result = await processor.processPDF(testUrl, filename, companyName);
        
        if (result) {
            console.log('\n✅ PDF Processing Test Results:');
            console.log(`📄 PDF: ${result.metadata.pdf_filename}`);
            console.log(`📊 Pages: ${result.metadata.total_pages}`);
            console.log(`📝 Total Text Length: ${result.metadata.total_text_length}`);
            console.log(`🔢 Chunks: ${result.metadata.total_chunks}`);
            
            console.log('\n🔍 ESG Keywords Found:');
            Object.entries(result.metadata.esg_keywords).forEach(([category, subcategories]) => {
                if (Object.keys(subcategories).length > 0) {
                    console.log(`  ${category.toUpperCase()}:`);
                    Object.entries(subcategories).forEach(([subcategory, keywords]) => {
                        console.log(`    ${subcategory}: ${keywords.join(', ')}`);
                    });
                }
            });
            
            // Save test results
            await processor.saveToJSONL(result, 'test_results.jsonl');
            
            console.log('\n📋 Sample Chunk:');
            if (result.chunks.length > 0) {
                const sampleChunk = result.chunks[0];
                console.log(`ID: ${sampleChunk.id}`);
                console.log(`Text Length: ${sampleChunk.text_length}`);
                console.log(`Text Preview: ${sampleChunk.text.substring(0, 200)}...`);
            }
            
        } else {
            console.log('❌ PDF processing failed');
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        // Clean up test files
        await processor.cleanupDownloads();
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testPDFProcessing().catch(console.error);
}

module.exports = testPDFProcessing; 