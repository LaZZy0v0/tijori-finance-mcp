const TYPE_TO_SECTION = {
  pl:        'profit_and_loss',
  bs:        'balance_sheet',
  cf:        'cash_flow',
  ratios:    'ratios',
  quarterly: 'quarterly_results',
};

export async function parseFinancials(page, type) {
  // Force DataTables to show all rows before extracting
  await page.evaluate(() => {
    try {
      if (window.jQuery) {
        window.jQuery('table.dataTable').each(function () {
          try { window.jQuery(this).DataTable().page.len(-1).draw(false); } catch (_) {}
        });
      }
    } catch (_) {}
  });
  await page.waitForTimeout(400);

  return page.evaluate(({ type, TYPE_TO_SECTION }) => {
    const sectionId = TYPE_TO_SECTION[type];
    const wrapperId = `${sectionId}_table_wrapper`;

    // Primary: find the dt-container wrapper by ID
    let wrapper = document.getElementById(wrapperId);

    // Fallback: find via the tab content section
    if (!wrapper) {
      const tabContent = document.getElementById(`company_table_innertab_${sectionId}_content`);
      wrapper = tabContent?.querySelector('.dt-container') ?? null;
    }

    if (!wrapper) return { type, rows: [], headers: [], error: `Section not found for type: ${type}` };

    // Period headers — only th.headerItem, skips firstcol and compare_col
    const periodHeaders = Array.from(wrapper.querySelectorAll('thead th.headerItem'))
      .map(th => th.textContent.trim())
      .filter(Boolean);

    // Data rows
    const rows = Array.from(wrapper.querySelectorAll('tbody tr')).flatMap(tr => {
      // Prefer data-id attribute; fall back to firstcol td text
      const label = tr.getAttribute('data-id')
        ?? tr.querySelector('td.firstcol')?.textContent.trim();
      if (!label) return [];

      // td.knowledge.numericvalue — automatically excludes compare_col
      const values = Array.from(tr.querySelectorAll('td.knowledge.numericvalue')).map(td => {
        const raw = td.textContent.trim().replace(/\s+/g, ' ');
        return raw === '—' || raw === '-' || raw === '' ? null : raw;
      });

      const row = { metric: label };
      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });
      return [row];
    });

    return { type, headers: ['metric', ...periodHeaders], rows };
  }, { type, TYPE_TO_SECTION });
}
