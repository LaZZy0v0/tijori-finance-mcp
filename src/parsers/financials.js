// Map from type parameter to the section/wrapper IDs used on Tijori Finance
const TYPE_TO_SECTION = {
  pl:        'profit_and_loss',
  bs:        'balance_sheet',
  cf:        'cash_flow',
  ratios:    'ratios',
  quarterly: 'quarterly_results',
};

export async function parseFinancials(page, type) {
  return page.evaluate(({ type, TYPE_TO_SECTION }) => {
    // --- Strategy 1: Look for inline JSON data blobs in <script> tags ---
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));

    const typeKeywords = {
      pl:        ['profit_loss', 'profitLoss', 'income_statement', 'pl_data', '"revenue"', '"sales"'],
      bs:        ['balance_sheet', 'balanceSheet', 'bs_data', '"total_assets"', '"equity"'],
      cf:        ['cash_flow', 'cashFlow', 'cf_data', '"operating_cash"', '"capex"'],
      ratios:    ['ratios', 'ratio_data', '"return_on_equity"', '"roe"', '"roce"'],
      quarterly: ['quarterly', 'quarter_data', '"qtr"', '"quarter"'],
    };

    const keywords = typeKeywords[type] ?? [];

    for (const s of scripts) {
      const text = s.textContent;
      if (!keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) continue;

      const jsonMatches = [...text.matchAll(/(?:var|const|let)\s+\w+\s*=\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*;/g)];
      for (const match of jsonMatches) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && typeof parsed === 'object') return { source: 'inline_script', data: parsed };
        } catch { /* try next */ }
      }
    }

    // --- Strategy 2: Extract from the specific section for this financial type ---
    const sectionId = TYPE_TO_SECTION[type];
    const wrapperId = sectionId ? `${sectionId}_table_wrapper` : null;

    // Try the dedicated wrapper div first, then the section, then fall back to all tables
    const containers = [];
    if (wrapperId) {
      const wrapper = document.getElementById(wrapperId);
      if (wrapper) containers.push(wrapper);
    }
    if (sectionId && containers.length === 0) {
      const section = document.getElementById(sectionId);
      if (section) containers.push(section);
    }
    // Fall back: scan all tables
    if (containers.length === 0) containers.push(document);

    const tables = [];
    containers.forEach(container => {
      container.querySelectorAll('table').forEach((table, idx) => {
        const headers = Array.from(table.querySelectorAll('thead th, thead td'))
          .map(th => th.textContent.trim())
          .filter(Boolean);

        if (headers.length === 0) return;

        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
          const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim());
          const row = {};
          cells.forEach((cell, i) => { row[headers[i] ?? `col${i}`] = cell; });
          return row;
        }).filter(r => Object.keys(r).length > 0);

        if (rows.length > 0) tables.push({ tableIndex: idx, headers, rows });
      });
    });

    if (tables.length > 0) return { source: 'html_tables', data: tables };

    return { source: 'none', data: null, error: 'No financial data found on page' };
  }, { type, TYPE_TO_SECTION });
}
