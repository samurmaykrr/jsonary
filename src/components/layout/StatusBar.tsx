import { useMemo } from 'react';
import { useActiveDocument } from '@/store/documentStore';
import { useEditor } from '@/store/editorStore';
import { CheckCircle, XCircle, Warning, FileJs } from '@phosphor-icons/react';
import { Tooltip } from '@/components/ui/Tooltip';

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
 */
function useJsonStats(content: string) {
  return useMemo(() => {
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
      return { objects, arrays, keys, isValid: true };
    } catch {
      return { objects: 0, arrays: 0, keys: 0, isValid: false };
    }
  }, [content]);
}

export function StatusBar() {
  const doc = useActiveDocument();
  const { goToError } = useEditor();
  
  const content = doc?.content ?? '';
  const { lines, chars, size } = useDocumentStats(content);
  const { isValid } = useJsonStats(content);
  
  // Determine validation status
  const hasParseError = doc?.parseError !== null && doc?.parseError !== undefined;
  const hasValidationErrors = (doc?.validationErrors?.length ?? 0) > 0;
  
  return (
    <footer className="h-7 border-t border-border-default bg-bg-surface flex items-center px-3 text-xs text-text-secondary select-none">
      {/* Left side - Status */}
      <div className="flex items-center gap-3">
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
                  <span className="text-red-500">Invalid JSON</span>
                </button>
              </Tooltip>
            ) : hasValidationErrors ? (
              <Tooltip content="Click to go to error (F8)" position="top">
                <button
                  onClick={goToError}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Warning weight="fill" className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-yellow-500">
                    {doc.validationErrors?.length} schema error{doc.validationErrors?.length !== 1 ? 's' : ''}
                  </span>
                </button>
              </Tooltip>
            ) : isValid ? (
              <>
                <CheckCircle weight="fill" className="w-3.5 h-3.5 text-green-500" />
                <span className="text-green-500">Valid JSON</span>
              </>
            ) : (
              <Tooltip content="Click to go to error (F8)" position="top">
                <button
                  onClick={goToError}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <XCircle weight="fill" className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-500">Invalid JSON</span>
                </button>
              </Tooltip>
            )}
          </div>
        )}
        
        {/* Separator */}
        {doc && <div className="w-px h-3 bg-border-default" />}
        
        {/* Document Info */}
        {doc && (
          <div className="flex items-center gap-1.5">
            <FileJs weight="regular" className="w-3.5 h-3.5 text-text-tertiary" />
            <span>{doc.name}</span>
          </div>
        )}
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Right side - Stats */}
      <div className="flex items-center gap-3">
        {doc && (
          <>
            {/* Line count */}
            <span>Ln {lines}</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default" />
            
            {/* Character count */}
            <span>{chars.toLocaleString()} chars</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default" />
            
            {/* File size */}
            <span>{size}</span>
            
            {/* Separator */}
            <div className="w-px h-3 bg-border-default" />
          </>
        )}
        
        {/* Encoding */}
        <span>UTF-8</span>
      </div>
    </footer>
  );
}
