// Content Analyzer Service
// Analyzes notes and extracts metadata, entities, and connections

export class ContentAnalyzer {
  
  // Extract tags from content
  static extractTags(content) {
    const tags = new Set();
    
    // Extract #tag patterns
    const hashTagRegex = /#([a-zA-Z\u4e00-\u9fa5_]+)/g;
    let match;
    while ((match = hashTagRegex.exec(content)) !== null) {
      tags.add(match[1].toLowerCase());
    }
    
    // Extract [[link]] patterns as potential tags
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    while ((match = linkRegex.exec(content)) !== null) {
      tags.add(match[1].toLowerCase());
    }
    
    return Array.from(tags);
  }

  // Extract block references (Logseq style ^block-id)
  static extractBlockRefs(content) {
    const refs = [];
    const refRegex = /\^([a-zA-Z0-9-]+)/g;
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      refs.push(match[1]);
    }
    return refs;
  }

  // Extract linked notes from [[note]] syntax
  static extractLinkedNotes(content) {
    const links = [];
    // Match [[note name]] but not [[#tag]]
    const linkRegex = /\[\[([^\][#][^\]]+)\]\]/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1].trim());
    }
    return [...new Set(links)];
  }

  // Analyze content and extract entities (simple NLP)
  static extractEntities(content) {
    const entities = {
      dates: [],
      times: [],
      emails: [],
      urls: [],
      mentions: []
    };
    
    // Extract dates
    const dateRegex = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?)/g;
    entities.dates = content.match(dateRegex) || [];
    
    // Extract times
    const timeRegex = /(\d{1,2}:\d{2}(?::\d{2})?)/g;
    entities.times = content.match(timeRegex) || [];
    
    // Extract emails
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    entities.emails = content.match(emailRegex) || [];
    
    // Extract URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    entities.urls = content.match(urlRegex) || [];
    
    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      entities.mentions.push(match[1]);
    }
    
    return entities;
  }

  // Generate summary from content
  static generateSummary(content, maxLength = 200) {
    // Remove markdown syntax
    let text = content
      .replace(/#{1,6}\s/g, '') // headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
      .replace(/\*([^*]+)\*/g, '$1') // italic
      .replace(/\[\[([^\]]+)\]\]/g, '$1') // links
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
      .replace(/`([^`]+)`/g, '$1') // inline code
      .replace(/\n+/g, ' ') // newlines
      .trim();
    
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  // Full analysis of a note
  static analyze(content, existingTags = []) {
    const tags = this.extractTags(content);
    const linkedNotes = this.extractLinkedNotes(content);
    const blockRefs = this.extractBlockRefs(content);
    const entities = this.extractEntities(content);
    const summary = this.generateSummary(content);
    
    // Merge and dedupe tags
    const allTags = [...new Set([...tags, ...existingTags])];
    
    return {
      tags: allTags,
      linkedNotes,
      blockRefs,
      entities,
      summary,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
      charCount: content.length
    };
  }

  // Analyze a todo for deadline extraction
  static analyzeTodo(content) {
    const entities = this.extractEntities(content);
    let deadline = null;
    let priority = 'medium';
    
    // Simple deadline detection
    const deadlinePatterns = [
      /截止[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/,
      /截止日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/,
      /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/,
    ];
    
    for (const pattern of deadlinePatterns) {
      const match = content.match(pattern);
      if (match) {
        // Try to parse the date
        const dateStr = match[1].replace('年', '-').replace('月', '-').replace('日', '');
        try {
          deadline = new Date(dateStr).toISOString();
        } catch {
          // Ignore parsing errors
        }
        break;
      }
    }
    
    // Priority detection
    if (/紧急|urgent|immediate/i.test(content)) {
      priority = 'urgent';
    } else if (/重要|important|soon/i.test(content)) {
      priority = 'high';
    } else if (/低|low|eventually/i.test(content)) {
      priority = 'low';
    }
    
    return {
      deadline,
      priority,
      entities
    };
  }
}

export default ContentAnalyzer;
