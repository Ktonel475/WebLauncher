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

const SIDE_TAB_COL = 0

// Gesture tuning
const DRAG_THRESHOLD = 0.2       // 20% of screen width
const VELOCITY_THRESHOLD = 0.5   // px/ms
const ANIM_MS = 350

function App() {
  const [apps, setApps] = useState([])
  const [currentCol, setCurrentCol] = useState(0)
  const [pageIndexByCol, setPageIndexByCol] = useState(() =>
    GRID.map(() => 0)
  )

  const trackRef = useRef(null)
  const sideTabRef = useRef(null)

  const startXRef = useRef(0)
  const startTimeRef = useRef(0)
  const dragXRef = useRef(0)
  const draggingRef = useRef(false)
  const lockedRef = useRef(false)
  const prevColRef = useRef(0)

  const W = () => window.innerWidth

  // ---- Load apps via Bridge API ----
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

  // ---- Distribute apps: 8 per sub-page, column-major ----
  const appsByPage = {}
  let cursor = 0
  GRID.forEach((col) => {
    col.pages.forEach((p) => {
      appsByPage[p.id] = apps.slice(cursor, cursor + 8)
      cursor += 8
    })
  })

  // ---- Transform (track + side tab) ----
  const applyTransform = (offset = 0, animate = false) => {
    if (trackRef.current) {
      trackRef.current.style.transition = animate
        ? `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : 'none'
      trackRef.current.style.transform =
        `translate3d(${-currentCol * W() + offset}px, 0, 0)`
    }
    if (sideTabRef.current) {
      // Side tab mirrors page 1's displacement, clamped so it stays parked
      // off-screen once we're past column 0.
      const displaced = Math.min(
        Math.max(-currentCol * W() + offset, -W()),
        0
      )
      sideTabRef.current.style.transition = animate
        ? `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : 'none'
      sideTabRef.current.style.transform =
        `translate3d(${displaced}px, 0, 0)`
    }
  }

  // ---- Pointer gesture handlers ----
  const onPointerDown = (e) => {
    if (lockedRef.current) return
    draggingRef.current = true
    startXRef.current = e.clientX
    startTimeRef.current = performance.now()
    dragXRef.current = 0
    applyTransform(0, false)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    let dx = e.clientX - startXRef.current

    // Resistance at edges
    const atStart = currentCol === 0 && dx > 0
    const atEnd = currentCol === GRID.length - 1 && dx < 0
    if (atStart || atEnd) dx *= 0.3

    dragXRef.current = dx
    applyTransform(dx, false)
  }

  const onPointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false

    const dx = dragXRef.current
    const dt = performance.now() - startTimeRef.current
    const velocity = dx / (dt || 1)

    const passedThreshold =
      Math.abs(dx) > W() * DRAG_THRESHOLD ||
      Math.abs(velocity) > VELOCITY_THRESHOLD

    let nextCol = currentCol
    if (passedThreshold) {
      if (dx < 0) nextCol = Math.min(currentCol + 1, GRID.length - 1)
      if (dx > 0) nextCol = Math.max(currentCol - 1, 0)
    }

    if (nextCol !== currentCol) {
      lockedRef.current = true
      setCurrentCol(nextCol)
      // applyTransform will run via effect below with animate = true
    } else {
      // bounce back to current column
      applyTransform(0, true)
    }

    dragXRef.current = 0

    setTimeout(() => {
      lockedRef.current = false
    }, ANIM_MS + 20)
  }

  // ---- Animate on currentCol change ----
  useEffect(() => {
    applyTransform(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol])

  // ---- Sync side tab visibility on col change ----
  useEffect(() => {
    if (!sideTabRef.current) return
    const isVisible = currentCol === SIDE_TAB_COL
    sideTabRef.current.style.pointerEvents = isVisible ? 'auto' : 'none'
    sideTabRef.current.setAttribute('aria-hidden', isVisible ? 'false' : 'true')
  }, [currentCol])

  // ---- Reset page 1 sub-index when leaving col 0 ----
  useEffect(() => {
    const prevCol = prevColRef.current
    if (prevCol === SIDE_TAB_COL && currentCol !== SIDE_TAB_COL) {
      setPageIndexByCol((prev) => {
        const next = [...prev]
        next[SIDE_TAB_COL] = 0
        return next
      })
    }
    prevColRef.current = currentCol
  }, [currentCol])

  // ---- Recompute on resize ----
  useEffect(() => {
    const onResize = () => applyTransform(0, false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol])

  // ---- Sub-page navigation via side tab ----
  const goToSubPage = (colIndex, pageIndex) => {
    setPageIndexByCol((prev) => {
      const next = [...prev]
      next[colIndex] = pageIndex
      return next
    })
  }

  // ---- Column navigation via bottom indicator ----
  const goToCol = (col) => {
    if (lockedRef.current || col === currentCol) return
    lockedRef.current = true
    setCurrentCol(col)
    setTimeout(() => {
      lockedRef.current = false
    }, ANIM_MS + 20)
  }

  const sideTabPages = GRID[SIDE_TAB_COL].pages
  const sideTabIndex = pageIndexByCol[SIDE_TAB_COL]
  const isSideTabVisible = currentCol === SIDE_TAB_COL

  return (
    <div className="launcher">
      {/* ===== Horizontal track (transform-based) ===== */}
      <div className="viewport">
        <div
          className="track"
          ref={trackRef}
          style={{ '--cols': GRID.length }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
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
      </div>

      {/* ===== Right side tab (rides with page 1) ===== */}
      <div className="side-tab" ref={sideTabRef} aria-hidden="true">
        <div className="side-tab-rail" />
        <div className="side-tab-inner">
          {sideTabPages.map((pageMeta, i) => (
            <button
              key={pageMeta.id}
              className={'side-dot' + (i === sideTabIndex ? ' active' : '')}
              aria-label={`Go to ${pageMeta.label}`}
              tabIndex={isSideTabVisible ? 0 : -1}
              onClick={() => goToSubPage(SIDE_TAB_COL, i)}
            />
          ))}
        </div>
      </div>

      {/* ===== Bottom column indicator ===== */}
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
