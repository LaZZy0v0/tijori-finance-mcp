/**
 * Extract table data from a section identified by its id.
 * Handles DataTables split-render (thead in dt-scroll-head, tbody in dt-scroll-body).
 */
async function extractSectionTable(page, sectionId) {
  return page.evaluate((sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return { rows: [], headers: [], error: `No section #${sectionId}` };

    // DataTables splits into separate scroll areas — headers in dt-scroll-head, body in dt-scroll-body
    // Try to grab headers from the head scroll area first
    const headTable = section.querySelector('.dt-scroll-head table, .dataTables_scrollHead table');
    const bodyTable = section.querySelector('.dt-scroll-body table, .dataTables_scrollBody table');

    // Fallback: if no DataTables structure, just pick the table with most rows
    const allTables = Array.from(section.querySelectorAll('table'));
    const targetBodyTable = bodyTable ?? allTables.reduce(
      (best, t) => (t.querySelectorAll('tbody tr').length > best.querySelectorAll('tbody tr').length ? t : best),
      allTables[0] ?? document.createElement('table')
    );
    const targetHeadTable = headTable ?? targetBodyTable;

    // Extract all header cells
    const rawHeaders = Array.from(targetHeadTable.querySelectorAll('thead th, thead td'))
      .map(th => th.textContent.trim());

    // Find the first non-empty header — that's where date/period columns start.
    // Columns before it (empty-header columns) are the metric label and sub-label.
    const firstDataColIdx = rawHeaders.findIndex(h => h.length > 0);
    const periodHeaders = firstDataColIdx >= 0 ? rawHeaders.slice(firstDataColIdx) : rawHeaders;

    // Extract rows — treat the first non-empty cell as the metric name,
    // then map remaining cells to period headers.
    const rows = Array.from(targetBodyTable.querySelectorAll('tbody tr'))
      .map(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        if (cells.every(c => !c)) return null;

        // The metric label is the first cell regardless of its header name
        const metric = cells[0] || null;
        if (!metric) return null;

        // Data values start after the label column(s)
        const dataOffset = firstDataColIdx >= 0 ? firstDataColIdx : 1;
        const row = { metric };
        cells.slice(dataOffset).forEach((cell, i) => {
          const header = periodHeaders[i];
          if (header) row[header] = cell;
        });
        return row;
      })
      .filter(Boolean);

    return { headers: ['metric', ...periodHeaders], rows };
  }, sectionId);
}

export async function parseRawMaterials(page, tab) {
  // tab: 'chemicals' | 'spreads' | 'metals'
  return extractSectionTable(page, tab);
}

export async function parseMacroIndicators(page, tab) {
  // tab: 'industry' | 'demand' | 'gdp'
  return extractSectionTable(page, tab);
}

export async function parseMarkets(page, tab) {
  // tab: 'headline' | 'niche' | 'conglomerates'
  return extractSectionTable(page, tab);
}
