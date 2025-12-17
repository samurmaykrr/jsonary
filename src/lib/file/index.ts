/**
 * File Operations Utilities
 * Handles file open, save, clipboard, and URL imports
 */

export interface FileOpenResult {
  name: string;
  content: string;
  path?: string;
}

export interface FileOpenOptions {
  accept?: string;
  multiple?: boolean;
}

/**
 * Open a file picker and read the selected file(s)
 */
export async function openFile(options: FileOpenOptions = {}): Promise<FileOpenResult | null> {
  const { accept = '.json,application/json', multiple = false } = options;
  
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const content = await file.text();
        resolve({
          name: file.name,
          content,
          path: file.name, // In browser, we only have the name
        });
      } catch {
        resolve(null);
      }
    };
    
    input.oncancel = () => {
      resolve(null);
    };
    
    input.click();
  });
}

/**
 * Open multiple files
 */
export async function openFiles(options: Omit<FileOpenOptions, 'multiple'> = {}): Promise<FileOpenResult[]> {
  const { accept = '.json,application/json' } = options;
  
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        resolve([]);
        return;
      }
      
      const results: FileOpenResult[] = [];
      for (const file of Array.from(files)) {
        try {
          const content = await file.text();
          results.push({
            name: file.name,
            content,
            path: file.name,
          });
        } catch {
          // Skip files that can't be read
        }
      }
      resolve(results);
    };
    
    input.oncancel = () => {
      resolve([]);
    };
    
    input.click();
  });
}

export interface SaveFileOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

/**
 * Save content to a file using the File System Access API or fallback
 */
export async function saveFile(
  content: string,
  options: SaveFileOptions = {}
): Promise<{ success: boolean; name?: string }> {
  const { suggestedName = 'document.json' } = options;
  
  // Try modern File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName,
        types: options.types ?? [
          {
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      
      return { success: true, name: handle.name };
    } catch (err) {
      // User cancelled or API not supported
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false };
      }
      // Fall through to legacy approach
    }
  }
  
  // Fallback: Download via anchor element
  try {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, name: suggestedName };
  } catch {
    return { success: false };
  }
}

/**
 * Save content to a specific format (JSON or CSV)
 */
export async function saveFileAs(
  content: string,
  format: 'json' | 'csv',
  suggestedName?: string
): Promise<{ success: boolean; name?: string }> {
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const extension = format === 'csv' ? '.csv' : '.json';
  const description = format === 'csv' ? 'CSV Files' : 'JSON Files';
  
  const defaultName = suggestedName ?? `document${extension}`;
  
  return saveFile(content, {
    suggestedName: defaultName,
    types: [
      {
        description,
        accept: { [mimeType]: [extension] },
      },
    ],
  });
}

export interface FetchUrlOptions {
  timeout?: number;
  corsProxy?: string;
}

/**
 * Fetch content from a URL
 */
export async function fetchFromUrl(
  url: string,
  options: FetchUrlOptions = {}
): Promise<{ content: string; name: string } | { error: string }> {
  const { timeout = 10000, corsProxy } = options;
  
  // Validate URL
  try {
    new URL(url);
  } catch {
    return { error: 'Invalid URL format' };
  }
  
  // Optionally use a CORS proxy
  const fetchUrl = corsProxy ? `${corsProxy}${encodeURIComponent(url)}` : url;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const content = await response.text();
    
    // Try to extract filename from URL or Content-Disposition
    let name = 'imported.json';
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match?.[1]) {
        name = match[1].replace(/['"]/g, '');
      }
    } else {
      // Extract from URL path
      const urlPath = new URL(url).pathname;
      const segments = urlPath.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && lastSegment.includes('.')) {
        name = lastSegment;
      }
    }
    
    return { content, name };
  } catch (err) {
    clearTimeout(timeoutId);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return { error: 'Request timed out' };
      }
      return { error: err.message };
    }
    return { error: 'Failed to fetch URL' };
  }
}

/**
 * Read content from clipboard
 */
export async function readFromClipboard(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Write content to clipboard
 */
export async function writeToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if content looks like JSON
 */
export function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

/**
 * Handle file drop event
 */
export async function handleFileDrop(
  event: DragEvent
): Promise<FileOpenResult[]> {
  event.preventDefault();
  
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return [];
  }
  
  const results: FileOpenResult[] = [];
  for (const file of Array.from(files)) {
    try {
      const content = await file.text();
      results.push({
        name: file.name,
        content,
        path: file.name,
      });
    } catch {
      // Skip files that can't be read
    }
  }
  
  return results;
}
