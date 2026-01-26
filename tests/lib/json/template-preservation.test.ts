import { describe, it, expect } from 'vitest';
import { repairJson } from '../../../src/lib/json/repair';
import { formatJson, compactJson, smartFormatJson, sortJsonKeys } from '../../../src/lib/json/formatter';

describe('Template Syntax Preservation - Repair', () => {
  describe('Templates as quoted strings (already valid JSON)', () => {
    it('preserves Jinja2 variables in quoted strings', () => {
      const input = '{"name": "{{ user.name }}", "age": 30}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ user.name }}');
      // Should be valid JSON
      const parsed = JSON.parse(result.output);
      expect(parsed.name).toBe('{{ user.name }}');
    });

    it('repairs broken JSON with quoted templates', () => {
      const input = '{name: "{{ user.name }}", age: 30}'; // Missing quotes on keys
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user.name }}');
      expect(result.output).toContain('"name"');
      expect(result.output).toContain('"age"');
    });

    it('repairs JSON with trailing commas and quoted templates', () => {
      const input = '{"name": "{{ user.name }}", "age": 30,}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user.name }}');
      expect(result.output).not.toMatch(/,\s*}/);
    });
  });

  describe('Templates as unquoted values (need preservation)', () => {
    it('preserves unquoted Jinja2 variables', () => {
      const input = '{"name": {{ user_name }}, "age": 30}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ user_name }}');
      expect(result.wasRepaired).toBe(true);
    });

    it('preserves Jinja2 statement blocks', () => {
      const input = '{"active": {% if active %}true{% else %}false{% endif %}}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{% if active %}');
      expect(result.output).toContain('{% else %}');
      expect(result.output).toContain('{% endif %}');
    });

    it('preserves multiple unquoted Jinja2 expressions', () => {
      const input = `{
        "user": {{ user_name }},
        "email": {{ user_email }},
        "active": {% if user_active %}yes{% endif %}
      }`;
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ user_name }}');
      expect(result.output).toContain('{{ user_email }}');
      expect(result.output).toContain('{% if user_active %}');
    });

    it('repairs broken JSON with unquoted templates', () => {
      const input = '{name: {{ user_name }}, age: 30}'; // Missing quotes on keys
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user_name }}');
      expect(result.output).toContain('"name"');
      expect(result.output).toContain('"age"');
    });

    it('handles complex Jinja2 expressions', () => {
      const input = '{"value": {{ config.nested.value | default(\'fallback\') }}}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain("{{ config.nested.value | default('fallback') }}");
    });

    it('preserves Jinja2 in arrays', () => {
      const input = '[{{ item1 }}, {{ item2 }}, "regular"]';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ item1 }}');
      expect(result.output).toContain('{{ item2 }}');
      expect(result.output).toContain('regular');
    });

    it('preserves nested structures with templates', () => {
      const input = `{
        "config": {
          "host": {{ db_host }},
          "port": {{ db_port }},
          "user": {{ db_user }}
        }
      }`;
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ db_host }}');
      expect(result.output).toContain('{{ db_port }}');
      expect(result.output).toContain('{{ db_user }}');
    });
  });

  describe('Handlebars/Mustache templates', () => {
    it('preserves unquoted Handlebars variables', () => {
      const input = '{"name": {{userName}}, "age": 30}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{userName}}');
    });

    it('preserves Handlebars comments', () => {
      const input = '{"key": {{! This is a comment }}value}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{! This is a comment }}');
    });

    it('preserves Handlebars block comments', () => {
      const input = '{"key": {{!-- This is a block comment --}}value}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{!-- This is a block comment --}}');
    });
  });

  describe('Mixed templates and broken JSON', () => {
    it('repairs single quotes with unquoted templates', () => {
      const input = "{'name': {{ user_name }}, 'age': 30}";
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user_name }}');
      expect(result.output).toMatch(/"name"/);
    });

    it('repairs missing commas with templates', () => {
      const input = '{"name": {{ user_name }} "age": 30}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user_name }}');
    });

    it('repairs missing closing brackets with templates', () => {
      const input = '{"name": {{ user_name }}, "age": 30';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user_name }}');
      expect(result.output).toMatch(/}\s*$/);
    });

    it('repairs comments and preserves templates', () => {
      const input = `{
        // User info
        "name": {{ user_name }},
        /* Age field */
        "age": 30
      }`;
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.wasRepaired).toBe(true);
      expect(result.output).toContain('{{ user_name }}');
      expect(result.output).not.toContain('//');
      expect(result.output).not.toContain('/*');
    });
  });

  describe('Template preservation option', () => {
    it('does not preserve templates when preserveTemplates is false', () => {
      const input = '{"name": {{ user_name }}}';
      const result = repairJson(input, { preserveTemplates: false });
      
      // With preserveTemplates: false, templates may be modified or cause errors
      expect(result.output).toBeDefined();
    });

    it('tracks template preservation in changes when templates are found', () => {
      const input = '{"name": {{ user_name }}, "age": 30}';
      const result = repairJson(input, { preserveTemplates: true, trackChanges: true });
      
      expect(result.changes).toBeDefined();
      const hasTemplateChange = result.changes?.some(
        (c) => c.type === 'preserved_templates'
      );
      expect(hasTemplateChange).toBe(true);
    });

    it('indicates number of preserved templates', () => {
      const input = '{"name": {{ user_name }}, "email": {{ user_email }}}';
      const result = repairJson(input, { preserveTemplates: true, trackChanges: true });
      
      const templateChange = result.changes?.find((c) => c.type === 'preserved_templates');
      expect(templateChange?.description).toMatch(/2 template/);
    });
  });

  describe('Edge cases', () => {
    it('handles empty templates', () => {
      const input = '{"name": {{  }}, "age": 30}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{  }}');
    });

    it('handles templates with special characters', () => {
      const input = '{"value": {{ var.field-name_123 }}}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ var.field-name_123 }}');
    });

    it('handles templates with filters and pipes', () => {
      const input = '{"date": {{ timestamp | date(\'%Y-%m-%d\') }}}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain("{{ timestamp | date('%Y-%m-%d') }}");
    });

    it('handles templates in object keys (edge case)', () => {
      const input = '{ {{ dynamic_key }}: "value"}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ dynamic_key }}');
    });

    it('preserves templates when repair fails', () => {
      const input = 'not valid json but has {{ template }}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{ template }}');
    });

    it('handles templates without spaces', () => {
      const input = '{"name": {{user_name}}, "count": {{items|length}}}';
      const result = repairJson(input, { preserveTemplates: true });
      
      expect(result.output).toContain('{{user_name}}');
      expect(result.output).toContain('{{items|length}}');
    });
  });
});

describe('Template Syntax Preservation - Formatting', () => {
  describe('formatJson with templates', () => {
    it('formats JSON while preserving quoted Jinja2 variables', () => {
      const input = '{"name":"{{ user.name }}","age":30}';
      const result = formatJson(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{{ user.name }}');
      // Should be formatted with newlines
      expect(result).toMatch(/\n/);
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('{{ user.name }}');
    });

    it('formats JSON with unquoted templates', () => {
      const input = '{"name":{{ user_name }},"age":30}';
      const result = formatJson(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{{ user_name }}');
    });

    it('formats JSON with multiple templates', () => {
      const input = '{"name":{{ user_name }},"email":{{ user_email }}}';
      const result = formatJson(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{{ user_name }}');
      expect(result).toContain('{{ user_email }}');
    });

    it('formats JSON with Jinja2 statements', () => {
      const input = '{"active":{% if active %}yes{% endif %}}';
      const result = formatJson(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{% if active %}');
      expect(result).toContain('{% endif %}');
    });

    it('uses tab indentation with templates', () => {
      const input = '{"name":{{ user_name }},"age":30}';
      const result = formatJson(input, { indent: 'tab', preserveTemplates: true });
      
      expect(result).toContain('{{ user_name }}');
    });

    it('does not preserve templates when option is false', () => {
      const input = '{"name":"{{ user.name }}"}';
      const result = formatJson(input, { indent: 2, preserveTemplates: false });
      
      expect(result).toBeDefined();
    });
  });

  describe('compactJson with templates', () => {
    it('compacts JSON while preserving quoted templates', () => {
      const input = `{
  "name": "{{ user.name }}",
  "age": 30
}`;
      const result = compactJson(input, { preserveTemplates: true });
      
      expect(result).toContain('{{ user.name }}');
      expect(result).not.toMatch(/\n/);
      expect(result).toBe('{"name":"{{ user.name }}","age":30}');
    });

    it('compacts JSON with unquoted templates', () => {
      const input = `{
  "user": {{ user_name }},
  "email": {{ user_email }}
}`;
      const result = compactJson(input, { preserveTemplates: true });
      
      expect(result).toContain('{{ user_name }}');
      expect(result).toContain('{{ user_email }}');
    });
  });

  describe('smartFormatJson with templates', () => {
    it('smart formats JSON with templates', () => {
      const input = '{"name":{{ user_name }},"age":30,"active":true}';
      const result = smartFormatJson(input, {
        indent: 2,
        maxLineLength: 80,
        preserveTemplates: true,
      });
      
      expect(result).toContain('{{ user_name }}');
      expect(result).toBeDefined();
    });

    it('keeps small objects inline with templates', () => {
      const input = '{"name":{{ user_name }},"age":30}';
      const result = smartFormatJson(input, {
        indent: 2,
        maxLineLength: 100,
        preserveTemplates: true,
      });
      
      expect(result).toContain('{{ user_name }}');
    });
  });

  describe('sortJsonKeys with templates', () => {
    it('sorts keys while preserving unquoted templates', () => {
      const input = '{"zebra":{{ z }},"alpha":{{ a }},"beta":{{ b }}}';
      const result = sortJsonKeys(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{{ z }}');
      expect(result).toContain('{{ a }}');
      expect(result).toContain('{{ b }}');
      
      // Check that keys are sorted (alpha comes before beta, beta before zebra)
      const alphaPos = result.indexOf('"alpha"');
      const betaPos = result.indexOf('"beta"');
      const zebraPos = result.indexOf('"zebra"');
      
      expect(alphaPos).toBeLessThan(betaPos);
      expect(betaPos).toBeLessThan(zebraPos);
    });

    it('sorts nested objects with templates', () => {
      const input = `{
  "z": {{ z }},
  "a": {
    "nested_z": {{ nz }},
    "nested_a": {{ na }}
  }
}`;
      const result = sortJsonKeys(input, { indent: 2, preserveTemplates: true });
      
      expect(result).toContain('{{ z }}');
      expect(result).toContain('{{ nz }}');
      expect(result).toContain('{{ na }}');
      
      // Check that "a" comes before "z"
      expect(result.indexOf('"a"')).toBeLessThan(result.indexOf('"z"'));
    });
  });

  describe('Formatting edge cases with templates', () => {
    it('handles invalid JSON with templates gracefully', () => {
      const input = 'not valid json {"name": {{ user }}}';
      const result = formatJson(input, { preserveTemplates: true });
      
      // Should return original input if parsing fails
      expect(result).toBe(input);
    });

    it('handles empty input', () => {
      const result = formatJson('', { preserveTemplates: true });
      expect(result).toBe('');
    });

    it('handles JSON with only quoted templates', () => {
      const input = '"{{ template }}"';
      const result = formatJson(input, { preserveTemplates: true });
      
      expect(result).toContain('{{ template }}');
    });
  });
});

describe('Real-world template scenarios', () => {
  it('handles Ansible playbook variables', () => {
    const input = `{
  "hosts": {{ inventory_hostname }},
  "vars": {
    "ansible_user": {{ ansible_user }},
    "app_port": {{ app_port | default(8080) }}
  }
}`;
    const result = repairJson(input, { preserveTemplates: true, trackChanges: true });
    
    expect(result.output).toContain('{{ inventory_hostname }}');
    expect(result.output).toContain('{{ ansible_user }}');
    expect(result.output).toContain('{{ app_port | default(8080) }}');
  });

  it('handles configuration templates', () => {
    const input = `{
  "database": {
    "host": {{ db_host }},
    "port": {{ db_port }},
    "name": {{ db_name }},
    "ssl": {% if db_ssl %}true{% else %}false{% endif %}
  }
}`;
    const result = repairJson(input, { preserveTemplates: true });
    
    expect(result.output).toContain('{{ db_host }}');
    expect(result.output).toContain('{{ db_port }}');
    expect(result.output).toContain('{{ db_name }}');
    expect(result.output).toContain('{% if db_ssl %}');
  });

  it('handles mixed broken JSON with templates', () => {
    const input = `{
  hosts: {{ inventory_hostname }},  // Missing quotes and has comment
  vars: {
    user: {{ ansible_user }},
    port: 8080,
  }
}`;
    const result = repairJson(input, { preserveTemplates: true, trackChanges: true });
    
    expect(result.wasRepaired).toBe(true);
    expect(result.output).toContain('{{ inventory_hostname }}');
    expect(result.output).toContain('{{ ansible_user }}');
    expect(result.output).toContain('"hosts"');
    expect(result.output).toContain('"vars"');
  });

  it('handles Jinja2 in list values', () => {
    const input = `{
  "servers": [
    {{ server1 }},
    {{ server2 }},
    "hardcoded-server"
  ]
}`;
    const result = repairJson(input, { preserveTemplates: true });
    
    expect(result.output).toContain('{{ server1 }}');
    expect(result.output).toContain('{{ server2 }}');
    expect(result.output).toContain('hardcoded-server');
  });
});
