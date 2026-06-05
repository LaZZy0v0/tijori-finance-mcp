export async function parseShareholding(page) {
  return page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));

    // Find the table with the most columns (the historical quarterly table),
    // among those that contain shareholding-related text
    let bestTable = null;
    let bestColCount = 0;

    for (const table of tables) {
      const text = table.textContent.toLowerCase();
      const hasShareholding =
        text.includes('promoter') &&
        (text.includes('public') || text.includes('fii') || text.includes('foreign') || text.includes('institutions'));
      if (!hasShareholding) continue;

      const firstRow = table.querySelector('tr');
      const colCount = firstRow ? firstRow.querySelectorAll('th, td').length : 0;
      if (colCount > bestColCount) {
        bestColCount = colCount;
        bestTable = table;
      }
    }

    if (!bestTable) return { quarters: [], error: 'Shareholding table not found' };

    // First row = header row with quarter labels
    const rows = Array.from(bestTable.querySelectorAll('tr'));
    if (rows.length < 2) return { quarters: [], error: 'Table has too few rows' };

    const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map(td => td.textContent.trim());
    // First column is the category label; rest are quarter periods
    const quarterPeriods = headerCells.slice(1).filter(Boolean);

    // Build per-quarter objects keyed by period
    const quarterMap = {};
    quarterPeriods.forEach(p => { quarterMap[p] = { period: p }; });

    // Each subsequent row = a shareholding category
    for (let i = 1; i < rows.length; i++) {
      const cells = Array.from(rows[i].querySelectorAll('td, th')).map(td => td.textContent.trim());
      if (cells.length < 2) continue;
      const category = cells[0];
      if (!category) continue;

      cells.slice(1).forEach((val, idx) => {
        const period = quarterPeriods[idx];
        if (!period) return;
        // Parse numeric value; treat em-dash as null
        const cleaned = val.replace('%', '').trim();
        if (cleaned === '—' || cleaned === '-' || cleaned === '') {
          quarterMap[period][category] = null;
        } else {
          const num = parseFloat(cleaned.replace(/,/g, ''));
          quarterMap[period][category] = isNaN(num) ? val : num;
        }
      });
    }

    return {
      quarters: Object.values(quarterMap).filter(q => Object.keys(q).length > 1),
    };
  });
}
