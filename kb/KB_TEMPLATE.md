# KB Item Template

Use this format for each knowledge item:

```json
{
  "id": "uuid",
  "title": "Item Title",
  "category": "tech|personal|projects|finance|health|misc",
  "tags": ["tag1", "tag2"],
  "summary": "Brief summary of the content",
  "keyTakeaways": ["Point 1", "Point 2", "Point 3"],
  "source": "original|upload|web",
  "filePath": "relative/path/to/file",
  "created": "2026-03-12T02:20:00Z",
  "lastUpdated": "2026-03-12T02:20:00Z"
}
```

## Folder Structure

```
kb/
├── tech/          # Tech documents
├── personal/      # Personal matters
├── projects/      # Project-specific
├── finance/       # Financial records
├── health/        # Health records
├── misc/          # Miscellaneous
└── metadata/
    └── index.json # Master index
```

## Processing Workflow

1. Receive file/content
2. Read and parse
3. Generate summary + key takeaways
4. Assign category + tags
5. Save to appropriate folder
6. Update index.json
7. Sync to dashboard (if applicable)