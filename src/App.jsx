import { useState, useEffect, useRef } from 'react'
import './App.css'

const GRID = [
  {
    id: 'col-0',
    pages: [
      { id: '1a', label: 'Page 1a', color: '#1a1a2e' },
      { id: '1b', label: 'Page 1b', color: '#16213e' },
      { id: '1c', label: 'Page 1c', color: '#0f3460' },
    ],
  },
  {
    id: 'col-1',
    pages: [{ id: '2', label: 'Page 2', color: '#533483' }],
  },
  {
    id: 'col-2',
    pages: [{ id: '3', label: 'Page 3', color: '#2c2c54' }],
  },
]

// Column index that owns the side tab (page 1)
const SIDE_TAB_COL = 0

function App() {
  const [apps, setApps] = useState([])
  const [currentCol, setCurrentCol] = useState(0)
  const [pageIndexByCol, setPageIndexByCol] = useState(() =>
    GRID.map(() => 0)
  )
  const sideTabRef = useRef(null)

  const pagerXRef = useRef(null)
  // Track previous column so we know when we *leave* col 0
  const prevColRef = useRef(0)

  useEffect(() => {
    async function loadApps() {
      try {
        const res = await fetch(window.Bridge.getAppsUrl())
        const data = await res.json()
        setApps(data)
      } catch (e) {
        console.error('Failed to load apps', e)
      }
    }
    loadApps()
  }, [])

  const launch = (pkg, activity) => {
    window.Bridge.launchApplication(pkg, activity)
  }

  const appsByPage = {}
  let cursor = 0
  GRID.forEach((col) => {
    col.pages.forEach((p) => {
      appsByPage[p.id] = apps.slice(cursor, cursor + 8)
      cursor += 8
    })
  })

  // Horizontal scroll handler
  const handlePagerScroll = () => {
    const el = pagerXRef.current
    if (!el) return

    // --- Direct DOM write (no React state) ---
    const clamped = Math.min(el.scrollLeft, el.clientWidth)
    if (sideTabRef.current) {
      sideTabRef.current.style.transform = `translate3d(-${clamped}px, 0, 0)`
      sideTabRef.current.style.pointerEvents = clamped > 1 ? 'none' : 'auto'
      sideTabRef.current.setAttribute('aria-hidden', clamped > 0 ? 'true' : 'false')
    }

    // --- React state only for column change (snap) ---
    const raw = el.scrollLeft / el.clientWidth
    const col = Math.round(raw)
    if (col === currentCol) return

    const prevCol = prevColRef.current

    if (prevCol === SIDE_TAB_COL && col !== SIDE_TAB_COL) {
      setPageIndexByCol((prev) => {
        const next = [...prev]
        next[SIDE_TAB_COL] = 0
        return next
      })
    }

    prevColRef.current = col
    setCurrentCol(col)
  }

  const goToCol = (col) => {
    const el = pagerXRef.current
    if (!el) return
    el.scrollTo({ left: col * el.clientWidth, behavior: 'smooth' })
  }

  const goToSubPage = (colIndex, pageIndex) => {
    setPageIndexByCol((prev) => {
      const next = [...prev]
      next[colIndex] = pageIndex
      return next
    })
  }

  const sideTabPages = GRID[SIDE_TAB_COL].pages
  const sideTabIndex = pageIndexByCol[SIDE_TAB_COL]

  return (
    <div className="launcher">
      {/* Horizontal pager */}
      <div
        className="pager-x"
        ref={pagerXRef}
        onScroll={handlePagerScroll}
      >
        {GRID.map((col, colIndex) => {
          const activeSubIndex = pageIndexByCol[colIndex]
          const activePage = col.pages[activeSubIndex]
          return (
            <div
              key={col.id}
              className="page"
              style={{ background: activePage.color }}
            >
              <div className="page-label">
                {activePage.label}
                <span className="page-counter">
                  {activeSubIndex + 1} / {col.pages.length}
                </span>
              </div>

              <div className="app-grid" key={activePage.id}>
                {appsByPage[activePage.id].map((app) => (
                  <button
                    key={app.package + app.activity}
                    className="app-icon"
                    onClick={() => launch(app.package, app.activity)}
                  >
                    <img
                      src={window.Bridge.getApplicationIconSrc(
                        app.package,
                        app.activity,
                        128
                      )}
                      alt={app.name}
                    />
                    <span>{app.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Right side tab — full height, only for page 1 */}
      <div
        className="side-tab"
        ref={sideTabRef}
        aria-hidden="true"
      >
        <div className="side-tab-rail" />
        <div className="side-tab-inner">
          {sideTabPages.map((pageMeta, i) => (
            <button
              key={pageMeta.id}
              className={'side-dot' + (i === sideTabIndex ? ' active' : '')}
              aria-label={`Go to ${pageMeta.label}`}
              onClick={() => goToSubPage(SIDE_TAB_COL, i)}
            />
          ))}
        </div>
      </div>
      {/* Bottom column indicator */}
      <div className="indicator">
        {GRID.map((col, colIndex) => (
          <button
            key={col.id}
            className={'dot' + (colIndex === currentCol ? ' active' : '')}
            aria-label={`Go to column ${colIndex + 1}`}
            onClick={() => goToCol(colIndex)}
          />
        ))}
      </div>
    </div>
  )
}

export default App
