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

    // Extract headers
    const headers = Array.from(targetHeadTable.querySelectorAll('thead th, thead td'))
      .map(th => th.textContent.trim());

    // Extract rows
    const rows = Array.from(targetBodyTable.querySelectorAll('tbody tr'))
      .map(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim().replace(/\s+/g, ' '));
        if (cells.every(c => !c)) return null;
        const row = {};
        cells.forEach((cell, i) => { row[headers[i] ?? `col${i}`] = cell; });
        return row;
      })
      .filter(Boolean);

    return { headers, rows };
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
