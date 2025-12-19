import { useState, useCallback, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import {
  useSettings,
} from '@/store/useSettingsStore';
import {
  type EditorSettings,
  type FormattingSettings,
  type BehaviorSettings,
  type UISettings,
} from '@/store/settingsContext';
import { getShortcutsList } from '@/hooks';
import { cn } from '@/lib/utils';
import { MONOSPACE_FONTS, loadGoogleFont } from '@/lib/fonts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'editor' | 'formatting' | 'behavior' | 'ui' | 'shortcuts';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');
  const { settings, updateEditor, updateFormatting, updateBehavior, updateUI, resetSettings } = useSettings();
  
  const tabs: { id: SettingsTab; label: string; shortLabel: string }[] = [
    { id: 'editor', label: 'Editor', shortLabel: 'Editor' },
    { id: 'formatting', label: 'Formatting', shortLabel: 'Format' },
    { id: 'behavior', label: 'Behavior', shortLabel: 'Behavior' },
    { id: 'ui', label: 'Appearance', shortLabel: 'UI' },
    { id: 'shortcuts', label: 'Shortcuts', shortLabel: 'Keys' },
  ];
  
  const handleReset = useCallback(() => {
    if (confirm('Reset all settings to defaults?')) {
      resetSettings();
    }
  }, [resetSettings]);
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button variant="ghost" onClick={handleReset} className="text-xs sm:text-sm">
            Reset to Defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="flex flex-col h-[75vh] sm:h-[60vh] sm:max-h-[500px]">
        {/* Mobile: Segmented tabs at top */}
        <div className="sm:hidden flex-shrink-0 mb-3">
          <div className="flex bg-bg-surface rounded-lg p-1 gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 px-2 py-2 text-xs font-medium rounded-md transition-colors',
                  activeTab === tab.id
                    ? 'bg-bg-active text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {tab.shortLabel}
              </button>
            ))}
          </div>
        </div>
        
        {/* Desktop: Sidebar layout */}
        <div className="flex-1 flex flex-col sm:flex-row gap-4 min-h-0">
          {/* Desktop sidebar */}
          <div className="hidden sm:block flex-shrink-0 border-r border-border-default pr-4 w-32">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm rounded transition-colors',
                    activeTab === tab.id
                      ? 'bg-bg-active text-text-primary font-medium'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto pr-0 sm:pr-2 min-h-0">
            {activeTab === 'editor' && (
              <EditorSettingsPanel settings={settings.editor} onUpdate={updateEditor} />
            )}
            {activeTab === 'formatting' && (
              <FormattingSettingsPanel settings={settings.formatting} onUpdate={updateFormatting} />
            )}
            {activeTab === 'behavior' && (
              <BehaviorSettingsPanel settings={settings.behavior} onUpdate={updateBehavior} />
            )}
            {activeTab === 'ui' && (
              <UISettingsPanel settings={settings.ui} onUpdate={updateUI} />
            )}
            {activeTab === 'shortcuts' && (
              <ShortcutsPanel />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Setting Row Components
// ============================================

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between py-3 border-b border-border-subtle last:border-0 gap-2">
      <div className="flex-1 sm:mr-4">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description && (
          <div className="text-xs text-text-tertiary mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors',
        'border-2 border-transparent',
        checked ? 'bg-accent' : 'bg-border-strong'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

interface SelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function Select({ value, options, onChange }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 text-sm rounded border border-border-default bg-bg-surface text-text-primary focus:outline-none focus:border-accent"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

function NumberInput({ value, onChange, min, max, step = 1 }: NumberInputProps) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => {
        const num = parseInt(e.target.value, 10);
        if (!isNaN(num)) {
          onChange(num);
        }
      }}
      min={min}
      max={max}
      step={step}
      className="w-20 text-right"
    />
  );
}

// ============================================
// Settings Panels
// ============================================

interface EditorSettingsPanelProps {
  settings: EditorSettings;
  onUpdate: (updates: Partial<EditorSettings>) => void;
}

function EditorSettingsPanel({ settings, onUpdate }: EditorSettingsPanelProps) {
  const [fontLoading, setFontLoading] = useState<string | null>(null);
  
  // Handle font change with loading
  const handleFontChange = useCallback(async (fontFamily: string) => {
    setFontLoading(fontFamily);
    try {
      await loadGoogleFont(fontFamily);
      onUpdate({ fontFamily });
    } catch (error) {
      console.error('Failed to load font:', error);
    } finally {
      setFontLoading(null);
    }
  }, [onUpdate]);
  
  // Load current font on mount if needed
  useEffect(() => {
    loadGoogleFont(settings.fontFamily);
  }, [settings.fontFamily]);
  
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Editor Settings</h3>
      
      <SettingRow label="Font Size" description="Editor font size in pixels">
        <NumberInput
          value={settings.fontSize}
          onChange={(fontSize) => onUpdate({ fontSize })}
          min={10}
          max={50}
        />
      </SettingRow>
      
      <SettingRow label="Font Family" description="Choose a monospace font for the editor">
        <div className="relative">
          <select
            value={settings.fontFamily}
            onChange={(e) => handleFontChange(e.target.value)}
            disabled={fontLoading !== null}
            className="px-2 py-1 text-sm rounded border border-border-default bg-bg-surface text-text-primary focus:outline-none focus:border-accent min-w-[160px]"
            style={{ fontFamily: settings.fontFamily }}
          >
            {MONOSPACE_FONTS.map((font) => (
              <option key={font.family} value={font.family} style={{ fontFamily: font.family }}>
                {font.name}
              </option>
            ))}
          </select>
          {fontLoading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
              Loading...
            </span>
          )}
        </div>
      </SettingRow>
      
      {/* Font preview */}
      <div className="mt-2 mb-4 p-3 bg-bg-surface rounded border border-border-subtle">
        <div className="text-xs text-text-tertiary mb-1">Preview</div>
        <div 
          className="text-sm text-text-primary"
          style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}
        >
          {"{ \"name\": \"JSON Editor\", \"version\": 1.0 }"}
        </div>
      </div>
      
      <SettingRow label="Tab Size" description="Number of spaces per indentation level">
        <Select
          value={settings.tabSize.toString()}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
          ]}
          onChange={(size) => onUpdate({ tabSize: parseInt(size, 10) })}
        />
      </SettingRow>
      
      <SettingRow label="Use Tabs" description="Use tabs instead of spaces for indentation">
        <Toggle
          checked={settings.useTabs}
          onChange={(useTabs) => onUpdate({ useTabs })}
        />
      </SettingRow>
      
      <SettingRow label="Line Wrapping" description="Wrap long lines instead of horizontal scrolling">
        <Toggle
          checked={settings.lineWrapping}
          onChange={(lineWrapping) => onUpdate({ lineWrapping })}
        />
      </SettingRow>
      
      <SettingRow label="Line Numbers" description="Show line numbers in the gutter">
        <Toggle
          checked={settings.lineNumbers}
          onChange={(lineNumbers) => onUpdate({ lineNumbers })}
        />
      </SettingRow>
      
      <SettingRow label="Highlight Active Line" description="Highlight the line containing the cursor">
        <Toggle
          checked={settings.highlightActiveLine}
          onChange={(highlightActiveLine) => onUpdate({ highlightActiveLine })}
        />
      </SettingRow>
      
      <SettingRow label="Match Brackets" description="Highlight matching brackets">
        <Toggle
          checked={settings.matchBrackets}
          onChange={(matchBrackets) => onUpdate({ matchBrackets })}
        />
      </SettingRow>
      
      <SettingRow label="Auto-close Brackets" description="Automatically close brackets and quotes">
        <Toggle
          checked={settings.autoCloseBrackets}
          onChange={(autoCloseBrackets) => onUpdate({ autoCloseBrackets })}
        />
      </SettingRow>
    </div>
  );
}

interface FormattingSettingsPanelProps {
  settings: FormattingSettings;
  onUpdate: (updates: Partial<FormattingSettings>) => void;
}

function FormattingSettingsPanel({ settings, onUpdate }: FormattingSettingsPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Formatting Settings</h3>
      
      <SettingRow label="Default Indent" description="Number of spaces for JSON formatting">
        <Select
          value={settings.defaultIndent.toString()}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
          ]}
          onChange={(size) => onUpdate({ defaultIndent: parseInt(size, 10) })}
        />
      </SettingRow>
      
      <SettingRow label="Smart Format Max Line Length" description="Maximum line length for smart formatting">
        <NumberInput
          value={settings.smartFormatMaxLineLength}
          onChange={(smartFormatMaxLineLength) => onUpdate({ smartFormatMaxLineLength })}
          min={40}
          max={200}
          step={10}
        />
      </SettingRow>
      
      <SettingRow label="Inline Threshold" description="Max items to display inline in smart format">
        <NumberInput
          value={settings.smartFormatInlineThreshold}
          onChange={(smartFormatInlineThreshold) => onUpdate({ smartFormatInlineThreshold })}
          min={1}
          max={10}
        />
      </SettingRow>
    </div>
  );
}

interface BehaviorSettingsPanelProps {
  settings: BehaviorSettings;
  onUpdate: (updates: Partial<BehaviorSettings>) => void;
}

function BehaviorSettingsPanel({ settings, onUpdate }: BehaviorSettingsPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Behavior Settings</h3>
      
      <SettingRow label="Auto-save Interval" description="Delay before auto-saving (0 to disable)">
        <Select
          value={settings.autoSaveInterval.toString()}
          options={[
            { value: '0', label: 'Disabled' },
            { value: '500', label: '0.5 seconds' },
            { value: '1000', label: '1 second' },
            { value: '2000', label: '2 seconds' },
            { value: '5000', label: '5 seconds' },
          ]}
          onChange={(interval) => onUpdate({ autoSaveInterval: parseInt(interval, 10) })}
        />
      </SettingRow>
      
      <SettingRow label="Confirm Before Close" description="Ask for confirmation when closing unsaved tabs">
        <Toggle
          checked={settings.confirmBeforeClose}
          onChange={(confirmBeforeClose) => onUpdate({ confirmBeforeClose })}
        />
      </SettingRow>
      
      <SettingRow label="Restore Session" description="Restore open tabs when reopening the app">
        <Toggle
          checked={settings.restoreSession}
          onChange={(restoreSession) => onUpdate({ restoreSession })}
        />
      </SettingRow>
    </div>
  );
}

interface UISettingsPanelProps {
  settings: UISettings;
  onUpdate: (updates: Partial<UISettings>) => void;
}

function UISettingsPanel({ settings, onUpdate }: UISettingsPanelProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Appearance Settings</h3>
      
      <SettingRow label="Theme" description="Choose your preferred color scheme">
        <Select
          value={settings.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(theme) => onUpdate({ theme: theme as 'light' | 'dark' | 'system' })}
        />
      </SettingRow>
      
      <SettingRow label="UI Scale" description="Scale the interface (affects all UI elements)">
        <Select
          value={settings.uiScale.toString()}
          options={[
            { value: '0.8', label: '80%' },
            { value: '0.9', label: '90%' },
            { value: '1', label: '100%' },
            { value: '1.1', label: '110%' },
            { value: '1.2', label: '120%' },
          ]}
          onChange={(scale) => onUpdate({ uiScale: parseFloat(scale) })}
        />
      </SettingRow>
      
      <SettingRow label="Default View Mode" description="Default view mode for new documents">
        <Select
          value={settings.defaultViewMode}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'tree', label: 'Tree' },
            { value: 'table', label: 'Table' },
          ]}
          onChange={(mode) => onUpdate({ defaultViewMode: mode as 'text' | 'tree' | 'table' })}
        />
      </SettingRow>
    </div>
  );
}

// ============================================
// Shortcuts Panel
// ============================================

function ShortcutsPanel() {
  const shortcuts = getShortcutsList();
  
  // Group shortcuts by category
  const categories = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category]!.push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);
  
  const categoryOrder = ['File', 'Edit', 'Format', 'View', 'Navigation', 'Other'];
  
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Keyboard Shortcuts</h3>
      <p className="text-xs text-text-tertiary mb-4">
        Use these keyboard shortcuts to work more efficiently. On Mac, use Cmd instead of Ctrl.
      </p>
      
      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const categoryShortcuts = categories[category];
          if (!categoryShortcuts) return null;
          
          return (
            <div key={category}>
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-bg-hover"
                  >
                    <span className="text-sm text-text-primary">{shortcut.description}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-bg-surface border border-border-default rounded text-text-secondary">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-border-subtle">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Editor-specific shortcuts
        </h4>
        <div className="text-xs text-text-tertiary space-y-1">
          <p><strong>Tree View:</strong> Arrow keys to navigate, Enter to edit/toggle, Del to delete</p>
          <p><strong>Table View:</strong> Arrow keys/Tab to navigate cells, Enter to edit, Del to delete row</p>
          <p><strong>Text View:</strong> Standard text editing shortcuts</p>
        </div>
      </div>
    </div>
  );
}
