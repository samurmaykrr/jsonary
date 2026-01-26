import { useMemo } from 'react';
import { useActiveDocument } from '@/store/useDocumentStore';
import { useEditor } from '@/store/useEditorStore';
import { CheckCircle, XCircle, Warning, FileJs } from '@phosphor-icons/react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useBranding } from '@/config/branding';
import { hasTemplateSyntax, repairJson } from '@/lib/json';

/**
 * Calculate document statistics
 */
function useDocumentStats(content: string) {
  return useMemo(() => {
    const lines = content.split('\n').length;
    const chars = content.length;
    const bytes = new TextEncoder().encode(content).length;
    
    // Format bytes nicely
    let size: string;
    if (bytes < 1024) {
      size = `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      size = `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      size = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    
    return { lines, chars, size };
  }, [content]);
}

/**
 * Parse JSON and count elements
 * Also checks for template syntax and attempts repair
 */
function useJsonStats(content: string) {
  return useMemo(() => {
    // Check for template syntax first
    const hasTemplates = hasTemplateSyntax(content);
    
    try {
      const parsed = JSON.parse(content);
      
      let objects = 0;
      let arrays = 0;
      let keys = 0;
      
      function count(value: unknown): void {
        if (Array.isArray(value)) {
          arrays++;
          value.forEach(count);
        } else if (value !== null && typeof value === 'object') {
          objects++;
          const entries = Object.entries(value);
          keys += entries.length;
          entries.forEach(([, v]) => count(v));
        }
      }
      
      count(parsed);
      return { objects, arrays, keys, isValid: true, hasTemplates: false };
    } catch {
      // If it has templates, try repairing it
      if (hasTemplates) {
        const repairResult = repairJson(content, { 
          preserveTemplates: true 
        });
        
        if (repairResult.output) {
          try {
            JSON.parse(repairResult.output);
            // Repairable with templates
            return { objects: 0, arrays: 0, keys: 0, isValid: false, hasTemplates: true, canRepair: true };
          } catch {
            // Has templates but still invalid even after repair
            return { objects: 0, arrays: 0, keys: 0, isValid: false, hasTemplates: true, canRepair: false };
          }
        }
      }
      
      return { objects: 0, arrays: 0, keys: 0, isValid: false, hasTemplates: false };
    }
  }, [content]);
}

export function StatusBar() {
  const branding = useBranding();
  const doc = useActiveDocument();
  const { goToError } = useEditor();

  const content = doc?.content ?? '';
  const { lines, chars, size } = useDocumentStats(content);
  const { isValid, hasTemplates, canRepair } = useJsonStats(content);
  
  // Determine validation status
  const hasParseError = doc?.parseError !== null && doc?.parseError !== undefined;
  const hasValidationErrors = (doc?.validationErrors?.length ?? 0) > 0;
  
  return (
    <footer className="h-7 border-t border-border-default bg-bg-surface flex items-center px-2 sm:px-3 text-xs text-text-secondary select-none">
      {/* Left side - Status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Validation Status */}
        {doc && (
          <div className="flex items-center gap-1.5">
            {hasParseError ? (
              <Tooltip content="Click to go to error (F8)" position="top">
                <button
                  onClick={goToError}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <XCircle weight="fill" className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-500 hidden sm:inline">Invalid JSON</span>
                  <span className="text-red-500 sm:hidden">Error</span>
                </button>
              </Tooltip>
            ) : hasValidationErrors ? (
              <Tooltip content="Click to go to error (F8)" position="top">
                <button
                  onClick={goToError}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Warning weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-yellow-500 hidden sm:inline">
                    {doc.validationErrors?.length} schema error{doc.validationErrors?.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-yellow-500 sm:hidden">
                    {doc.validationErrors?.length}
                  </span>
                </button>
              </Tooltip>
            ) : isValid ? (
              <>
                <CheckCircle weight="fill" className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-500 hidden sm:inline">Valid JSON</span>
                <span className="text-green-500 sm:hidden">OK</span>
              </>
            ) : hasTemplates && canRepair ? (
              <Tooltip content="JSON with template syntax (use Format to fix)" position="top">
                <div className="flex items-center gap-1.5">
                  <Warning weight="fill" className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-blue-500 hidden sm:inline">JSON with Templates</span>
                  <span className="text-blue-500 sm:hidden">Template</span>
                </div>
              </Tooltip>
            ) : (
              <Tooltip content="Click to go to error (F8)" position="top">
                <button
                  onClick={goToError}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <XCircle weight="fill" className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-500 hidden sm:inline">Invalid JSON</span>
                  <span className="text-red-500 sm:hidden">Error</span>
                </button>
              </Tooltip>
            )}
          </div>
        )}
        
        {/* Separator - hidden on mobile */}
        {doc && <div className="hidden sm:block w-px h-3 bg-border-default" />}
        
        {/* Document Info - hidden on mobile */}
        {doc && (
          <div className="hidden sm:flex items-center gap-1.5">
            <FileJs weight="regular" className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="truncate max-w-[150px]">{doc.name}</span>
          </div>
        )}
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Right side - Stats */}
      <div className="flex items-center gap-2 sm:gap-3">
        {doc && (
          <>
            {/* Line count */}
            <span className="hidden sm:inline">Ln {lines}</span>
            <span className="sm:hidden">{lines}L</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default hidden sm:block" />
            
            {/* Character count - hidden on small mobile */}
            <span className="hidden sm:inline">{chars.toLocaleString()} chars</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default hidden sm:block" />
            
            {/* File size */}
            <span>{size}</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default hidden sm:block" />
          </>
        )}
        
        {/* Encoding - hidden on mobile */}
        <span className="hidden sm:inline">UTF-8</span>
        
        {/* Separator */}
        <div className="w-px h-3 bg-border-default" />
        
        {/* Built by credit */}
        <a
          href={branding.app.author.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Built by <span className="hidden sm:inline">{branding.app.author.displayName}</span><span className="sm:hidden">@{branding.app.author.name}</span>
        </a>
      </div>
    </footer>
  );
}
