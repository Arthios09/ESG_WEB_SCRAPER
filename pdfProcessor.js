const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');

class PDFProcessor {
    constructor() {
        this.downloadDir = path.join(process.cwd(), 'downloads');
        this.ensureDownloadDir();
    }

    async ensureDownloadDir() {
        await fs.ensureDir(this.downloadDir);
    }

    async downloadPDF(url, filename) {
        try {
            console.log(`📥 Downloading PDF: ${filename}`);
            
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const filepath = path.join(this.downloadDir, filename);
            await fs.writeFile(filepath, response.data);
            
            console.log(`✅ PDF downloaded: ${filepath}`);
            return filepath;
            
        } catch (error) {
            console.error(`❌ Failed to download PDF ${url}:`, error.message);
            return null;
        }
    }

    async extractTextFromPDF(filepath) {
        try {
            console.log(`📄 Extracting text from: ${path.basename(filepath)}`);
            
            const dataBuffer = await fs.readFile(filepath);
            const data = await pdfParse(dataBuffer);
            
            return {
                text: data.text,
                pages: data.numpages,
                info: data.info,
                metadata: data.metadata
            };
            
        } catch (error) {
            console.error(`❌ Failed to extract text from ${filepath}:`, error.message);
            return null;
        }
    }

    chunkText(text, chunkSize = 2000, overlap = 200) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        let chunkIndex = 0;
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i].trim();
            
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    id: chunkIndex++,
                    text: currentChunk.trim(),
                    startSentence: Math.max(0, i - Math.floor(overlap / 50)),
                    endSentence: i - 1
                });
                
                // Start new chunk with overlap
                const overlapSentences = sentences.slice(Math.max(0, i - Math.floor(overlap / 50)), i);
                currentChunk = overlapSentences.join('. ') + '. ' + sentence;
            } else {
                currentChunk += (currentChunk ? '. ' : '') + sentence;
            }
        }
        
        // Add the last chunk
        if (currentChunk.trim()) {
            chunks.push({
                id: chunkIndex,
                text: currentChunk.trim(),
                startSentence: Math.max(0, sentences.length - Math.floor(overlap / 50)),
                endSentence: sentences.length - 1
            });
        }
        
        return chunks;
    }

    extractESGKeywords(text) {
        const keywords = {
            environmental: {
                carbon: ['carbon', 'emissions', 'co2', 'greenhouse gas', 'climate change', 'carbon footprint'],
                energy: ['energy', 'renewable', 'solar', 'wind', 'hydroelectric', 'energy efficiency'],
                waste: ['waste', 'recycling', 'circular economy', 'zero waste', 'landfill'],
                water: ['water', 'water usage', 'water conservation', 'water footprint'],
                biodiversity: ['biodiversity', 'ecosystem', 'conservation', 'wildlife', 'habitat']
            },
            social: {
                diversity: ['diversity', 'inclusion', 'equity', 'representation', 'minority'],
                workforce: ['employee', 'workforce', 'labor', 'human rights', 'working conditions'],
                community: ['community', 'philanthropy', 'charitable', 'social impact', 'local'],
                safety: ['safety', 'health', 'occupational', 'workplace safety', 'wellness'],
                supply_chain: ['supply chain', 'supplier', 'vendor', 'procurement', 'sourcing']
            },
            governance: {
                board: ['board', 'director', 'governance', 'leadership', 'executive'],
                ethics: ['ethics', 'compliance', 'corruption', 'bribery', 'integrity'],
                transparency: ['transparency', 'disclosure', 'reporting', 'accountability'],
                risk: ['risk', 'risk management', 'compliance risk', 'operational risk'],
                stakeholder: ['stakeholder', 'shareholder', 'investor', 'engagement']
            }
        };

        const foundKeywords = {
            environmental: {},
            social: {},
            governance: {}
        };

        const lowerText = text.toLowerCase();

        Object.entries(keywords).forEach(([category, subcategories]) => {
            Object.entries(subcategories).forEach(([subcategory, terms]) => {
                const matches = terms.filter(term => lowerText.includes(term));
                if (matches.length > 0) {
                    foundKeywords[category][subcategory] = matches;
                }
            });
        });

        return foundKeywords;
    }

    async processPDF(url, filename, companyName) {
        try {
            // Download PDF
            const filepath = await this.downloadPDF(url, filename);
            if (!filepath) return null;

            // Extract text
            const pdfData = await this.extractTextFromPDF(filepath);
            if (!pdfData) return null;

            // Chunk text
            const chunks = this.chunkText(pdfData.text);
            
            // Extract ESG keywords from full text
            const esgKeywords = this.extractESGKeywords(pdfData.text);

            // Process each chunk
            const processedChunks = chunks.map(chunk => {
                const chunkKeywords = this.extractESGKeywords(chunk.text);
                
                return {
                    id: `${filename}_chunk_${chunk.id}`,
                    company: companyName,
                    source_url: url,
                    pdf_filename: filename,
                    chunk_index: chunk.id,
                    text: chunk.text,
                    text_length: chunk.text.length,
                    start_sentence: chunk.startSentence,
                    end_sentence: chunk.endSentence,
                    esg_keywords: chunkKeywords,
                    created_at: new Date().toISOString()
                };
            });

            return {
                metadata: {
                    company: companyName,
                    source_url: url,
                    pdf_filename: filename,
                    total_pages: pdfData.pages,
                    total_chunks: chunks.length,
                    total_text_length: pdfData.text.length,
                    pdf_info: pdfData.info,
                    esg_keywords: esgKeywords,
                    processed_at: new Date().toISOString()
                },
                chunks: processedChunks
            };

        } catch (error) {
            console.error(`❌ Error processing PDF ${url}:`, error.message);
            return null;
        }
    }

    async saveToJSONL(data, filename) {
        try {
            const filepath = path.join(process.cwd(), filename);
            
            // Save metadata
            await fs.writeFile(
                filepath.replace('.jsonl', '_metadata.json'),
                JSON.stringify(data.metadata, null, 2)
            );

            // Save chunks in JSONL format (one JSON object per line)
            const jsonlContent = data.chunks.map(chunk => JSON.stringify(chunk)).join('\n');
            await fs.writeFile(filepath, jsonlContent);
            
            console.log(`💾 Saved to JSONL: ${filepath}`);
            return filepath;
            
        } catch (error) {
            console.error(`❌ Error saving JSONL:`, error.message);
            return null;
        }
    }

    async cleanupDownloads() {
        try {
            await fs.remove(this.downloadDir);
            console.log(`🧹 Cleaned up downloads directory`);
        } catch (error) {
            console.error(`❌ Error cleaning up:`, error.message);
        }
    }
}

module.exports = PDFProcessor; 