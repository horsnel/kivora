'use client'

/**
 * DataTable — Claude-style rounded table for structured data
 * Matches the existing Kivora design system:
 *   - Rounded corners, #111 header, #1a1a1a borders
 *   - tabular-nums on numeric columns
 *   - Weight/padding differentiation (no new colors)
 *   - Responsive: horizontal scroll on mobile
 */

export default function DataTable({ columns, rows, footer }) {
  return (
    <div className="my-0 -mx-1 overflow-x-auto overscroll-behavior-contain">
      <div className="inline-block min-w-full align-middle">
        <table className="w-full text-left border-collapse separate border-spacing-0 overflow-hidden rounded-xl border border-[#1a1a1a]">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  className={`
                    text-left text-caption font-semibold text-[#737373] px-4 py-2.5 bg-[#111]
                    ${col.align === 'right' ? 'text-right' : ''}
                    ${col.numeric ? 'tabular-nums font-mono' : ''}
                    ${i === 0 ? 'rounded-tl-xl' : ''}
                    ${i === columns.length - 1 ? 'rounded-tr-xl' : ''}
                  `}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-[#1a1a1a] last:border-0 hover:bg-[#141414]/50 transition-colors"
              >
                {columns.map((col) => {
                  const cell = row[col.key]
                  return (
                    <td
                      key={col.key}
                      className={`
                        text-body text-[#d4d4d4] px-4 py-2.5
                        ${col.align === 'right' ? 'text-right' : ''}
                        ${col.numeric ? 'tabular-nums font-mono' : ''}
                        ${col.cellClassName || ''}
                      `}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot>
              <tr className="bg-[#111]">
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-2.5 text-body font-semibold text-[#d4d4d4]
                      ${col.align === 'right' ? 'text-right' : ''}
                      ${col.numeric ? 'tabular-nums font-mono font-bold' : ''}
                      ${i === 0 ? 'rounded-bl-xl' : ''}
                      ${i === columns.length - 1 ? 'rounded-br-xl' : ''}
                    `}
                  >
                    {footer[col.key] || ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
