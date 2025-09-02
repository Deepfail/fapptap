# Knowledge Base Maintenance Instructions

## Purpose
This document ensures the Tauri v2 Comprehensive Knowledge Base (`TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md`) remains the single source of truth for all Tauri v2 patterns, troubleshooting, and best practices.

## For AI Assistants/Agents

### MANDATORY REFERENCE PROTOCOL
**ALWAYS** reference `TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md` when:
- Troubleshooting Tauri v2 issues
- Configuring sidecar binaries
- Setting up permissions/capabilities  
- Debugging asset protocol problems
- Implementing platform detection
- Working with media files/URLs
- Any Tauri v2 development task

### UPDATE TRIGGER CONDITIONS
Update the knowledge base **immediately** when you discover:
- ✅ New Tauri v2 configuration patterns that work
- ✅ Solutions to previously unknown errors
- ✅ Better practices or optimizations
- ✅ Changes in Tauri v2 API behavior
- ✅ New plugin requirements or configurations
- ✅ Platform-specific workarounds
- ✅ Performance improvements
- ✅ Security considerations

### UPDATE PROCESS
1. **Reference First**: Always check existing knowledge base before implementing solutions
2. **Document New Learnings**: Add any new discoveries to the appropriate section
3. **Update Examples**: Ensure code examples reflect current working patterns
4. **Commit Changes**: Use descriptive commit messages like "📚 KB: Added [specific learning]"
5. **Cross-Reference**: Link related sections for better discoverability

### KNOWLEDGE BASE SECTIONS TO MAINTAIN

#### Critical Configurations
- Asset protocol setup
- Sidecar binary configuration  
- Permission/capability patterns
- Platform detection methods

#### Troubleshooting Patterns
- Error messages and solutions
- Binary naming conventions
- Cache invalidation procedures
- URL generation issues

#### Code Patterns
- Dynamic plugin imports
- Media URL conversion
- Platform-specific implementations
- Error handling strategies

#### Build/Deploy Workflows
- Development vs production differences
- Binary inclusion processes
- Performance optimizations
- Testing strategies

### VALIDATION CHECKLIST
Before any Tauri v2 work, verify the knowledge base includes:
- [ ] Current working configurations
- [ ] Latest troubleshooting solutions
- [ ] Updated code examples
- [ ] Performance best practices
- [ ] Security considerations

## For Human Developers

### Regular Maintenance Schedule
- **Weekly**: Review for outdated information
- **Monthly**: Check against latest Tauri releases
- **Per Issue**: Update when solving new problems
- **Per Feature**: Document new patterns discovered

### Quality Standards
- All code examples must be tested and working
- Error solutions must include root cause analysis
- Configuration examples must be complete and minimal
- Cross-references between related topics

### Update Format
```markdown
## [Section Name] - Updated [Date]

### [Specific Learning/Issue]
**Problem**: [Description]
**Solution**: [Working solution]
**Code Example**: 
```language
[working code]
```
**Verification**: [How to confirm it works]
**Related**: [Links to related sections]
```

## Automation Helpers

### Git Hooks (Future Enhancement)
Create pre-commit hooks that:
- Check if Tauri-related changes reference the knowledge base
- Validate that new Tauri patterns are documented
- Ensure knowledge base is updated with commits

### Documentation Validation
- All tauri.conf.json changes should update knowledge base
- New capability/permission patterns must be documented
- Error fixes should include knowledge base updates

## Knowledge Base Linking Strategy

### In Code Comments
```typescript
// Reference: TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md - Platform Detection Pattern
export const isTauri = (): boolean => {
  return typeof import.meta.env.TAURI_ENV_PLATFORM !== 'undefined';
};
```

### In Commit Messages
```
🔧 Fix asset protocol scope issue

- Updated tauri.conf.json with proper scope configuration
- Added fallback for file:// URLs in browser mode
- Updated TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md with URL troubleshooting

Reference: Knowledge Base Section "Asset Protocol Configuration"
```

### In Pull Requests
Include knowledge base updates as part of any Tauri v2 changes:
- Link to relevant knowledge base sections
- Document any new patterns discovered
- Update examples if implementation differs

## Success Metrics

### Knowledge Base Health
- **Accuracy**: All examples work with current Tauri version
- **Completeness**: Covers all major use cases and issues
- **Currency**: Updated within 1 week of any Tauri-related changes
- **Discoverability**: Well-organized with clear section headers

### Usage Indicators
- AI assistants reference it before implementing solutions
- Human developers consult it for troubleshooting
- New team members use it as onboarding reference
- External contributors find it helpful

## Emergency Recovery

### If Knowledge Base Becomes Outdated
1. **Audit Current State**: Compare with working codebase
2. **Identify Gaps**: Note missing or incorrect information
3. **Batch Update**: Systematically update all sections
4. **Validate Examples**: Test all code snippets
5. **Cross-Reference**: Ensure internal links work

### If Knowledge Base Is Lost
The knowledge base can be reconstructed from:
- Working tauri.conf.json and capabilities files
- Functional TypeScript code patterns
- Git commit history with KB updates
- This maintenance instruction document

## Implementation Priority

### Phase 1: Immediate (High Priority)
- [ ] Add knowledge base reference to all Tauri-related code comments
- [ ] Update .github/instructions/AUTO-MODE.instructions.md to require KB reference
- [ ] Create commit message template that prompts for KB updates

### Phase 2: Short-term (Medium Priority)  
- [ ] Add knowledge base validation to CI/CD pipeline
- [ ] Create automated checks for outdated examples
- [ ] Implement knowledge base section linking in code

### Phase 3: Long-term (Enhancement)
- [ ] Git hooks for automatic KB maintenance
- [ ] Integration with documentation generation
- [ ] External validation against Tauri releases

---

**Remember**: The knowledge base is only valuable if it's current, accurate, and consistently used. Make KB maintenance a core part of every Tauri v2 development workflow.