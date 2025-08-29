# Filesystem MCP Server Guidelines

## Purpose

Optimize usage of the Filesystem MCP server for efficient file operations while maintaining security and performance.

## Golden Rules

1. **Query before write** - Use read operations to understand file structure before making changes
2. **Minimal permissions** - Use the least privileged operations needed for the task
3. **Batch operations** - Combine related file operations when possible
4. **Path validation** - Always validate paths before operations to avoid errors

## Auto-Approved Operations

The following operations are auto-approved for safe usage:

- `list_allowed_directories` - Check accessible directories
- `list_directory` - Browse directory contents
- `get_file_info` - Get file metadata
- `read_text_file` - Read file contents

## Manual Approval Required

These operations require explicit approval due to potential impact:

- `write_file` - File creation/overwrite
- `edit_file` - File modification
- `move_file` - File movement/renaming
- `create_directory` - Directory creation

## Best Practices

### Reading Files

- Use `read_text_file` with `head` or `tail` parameters for large files
- Prefer `list_directory` over manual path construction
- Use `search_files` for pattern matching instead of manual filtering

### Writing Files

- Always read file first to understand current structure
- Use `write_file` for complete file replacements
- Use `edit_file` for targeted changes to existing files
- Include proper error handling for file operations

### Directory Operations

- Use `create_directory` for nested directory creation
- Validate directory existence before file operations
- Use `list_directory_with_sizes` for space analysis

## Security Considerations

- Never operate outside allowed directories
- Validate user input for file paths
- Avoid executing untrusted file content
- Use appropriate file permissions

## Performance Tips

- Cache directory listings for repeated operations
- Use specific file patterns in searches
- Close file handles promptly
- Batch related file operations

## Common Use Cases

### Code Development

- Analyze project structure with `list_directory`
- Read source files with `read_text_file`
- Search for patterns with `search_files`
- Create new components with `write_file`

### Configuration Management

- Read config files with `read_text_file`
- Update settings with `edit_file`
- Backup files before major changes

### Documentation

- Browse documentation structure
- Read markdown files
- Update documentation with targeted edits

## Error Handling

- Handle file not found errors gracefully
- Check permissions before operations
- Provide clear error messages
- Fallback to alternative approaches when needed

## Integration with Memory Server

- Store frequently accessed file paths in memory
- Cache directory structures for quick reference
- Save file operation patterns for reuse
- Document file organization conventions

---

**Optimized for secure and efficient file operations in development workflows**
