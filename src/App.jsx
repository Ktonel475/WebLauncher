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
    pages: [{ id: '2', label: 'Page 2', color: 'transparent' }],
  },
  {
    id: 'col-2',
    pages: [{ id: '3', label: 'Page 3', color: 'transparent' }],
  },
]

const SIDE_TAB_COL = 0

// Gesture tuning
const DRAG_THRESHOLD = 0.2       // 20% of screen
const VELOCITY_THRESHOLD = 0.5   // px/ms
const ANIM_MS = 350
const AXIS_LOCK_PX = 8           // movement needed before locking an axis

function App() {
  const [apps, setApps] = useState([])
  const [currentCol, setCurrentCol] = useState(0)
  const [pageIndexByCol, setPageIndexByCol] = useState(() =>
    GRID.map(() => 0)
  )

  const trackRef = useRef(null)
  const sideTabRef = useRef(null)

  // Gesture refs
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startTimeRef = useRef(0)
  const dragXRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const axisRef = useRef(null)        // 'x' | 'y' | null
  const lockedRef = useRef(false)
  const prevColRef = useRef(0)

  const W = () => window.innerWidth
  const H = () => window.innerHeight

  // ---- Derived values ----
  const currentRow = pageIndexByCol[currentCol]
  const sideTabPages = GRID[SIDE_TAB_COL].pages
  const sideTabIndex = pageIndexByCol[SIDE_TAB_COL]
  const isSideTabVisible = currentCol === SIDE_TAB_COL

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

  // ---- Transform (2D: track + side tab) ----
  const applyTransform = (dx = 0, dy = 0, animate = false) => {
    const transition = animate
      ? `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none'

    if (trackRef.current) {
      trackRef.current.style.transition = transition
      trackRef.current.style.transform =
        `translate3d(${-currentCol * W() + dx}px, ${-currentRow * H() + dy}px, 0)`
    }
    if (sideTabRef.current) {
      // Side tab mirrors page 1's horizontal displacement only,
      // clamped so it stays parked off-screen past column 0.
      const displaced = Math.min(
        Math.max(-currentCol * W() + dx, -W()),
        0
      )
      sideTabRef.current.style.transition = transition
      sideTabRef.current.style.transform = `translate3d(${displaced}px, 0, 0)`
    }
  }

  // ---- Pointer gesture handlers ----
  const onPointerDown = (e) => {
    if (lockedRef.current) return
    draggingRef.current = true
    axisRef.current = null
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    startTimeRef.current = performance.now()
    dragXRef.current = 0
    dragYRef.current = 0
    applyTransform(0, 0, false)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return

    let dx = e.clientX - startXRef.current
    let dy = e.clientY - startYRef.current

    // Decide axis once per gesture
    if (!axisRef.current) {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax > AXIS_LOCK_PX || ay > AXIS_LOCK_PX) {
        axisRef.current = ax > ay ? 'x' : 'y'
      }
    }

    if (axisRef.current === 'x') {
      // Horizontal — clamp at first/last column
      const atStart = currentCol === 0 && dx > 0
      const atEnd = currentCol === GRID.length - 1 && dx < 0
      if (atStart || atEnd) dx *= 0.3
      dy = 0
    } else if (axisRef.current === 'y') {
      // Vertical — clamp at first/last sub-page of the *current* column
      const subCount = GRID[currentCol].pages.length
      const atTop = currentRow === 0 && dy > 0
      const atBottom = currentRow === subCount - 1 && dy < 0
      if (atTop || atBottom) dy *= 0.3
      dx = 0
    } else {
      // Undecided — don't move yet
      return
    }

    dragXRef.current = dx
    dragYRef.current = dy
    applyTransform(dx, dy, false)
  }

  const onPointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false

    const dx = dragXRef.current
    const dy = dragYRef.current
    const dt = performance.now() - startTimeRef.current
    const vx = dx / (dt || 1)
    const vy = dy / (dt || 1)

    dragXRef.current = 0
    dragYRef.current = 0

    if (axisRef.current === 'x') {
      const passed =
        Math.abs(dx) > W() * DRAG_THRESHOLD ||
        Math.abs(vx) > VELOCITY_THRESHOLD

      let nextCol = currentCol
      if (passed) {
        if (dx < 0) nextCol = Math.min(currentCol + 1, GRID.length - 1)
        if (dx > 0) nextCol = Math.max(currentCol - 1, 0)
      }

      if (nextCol !== currentCol) {
        lockedRef.current = true
        if (trackRef.current) {
          trackRef.current.style.transition = 'none'
          trackRef.current.style.transform =
            `translate3d(${-nextCol * W()}px, ${-pageIndexByCol[nextCol] * H()}px, 0)`
        }
        void trackRef.current.offsetWidth
        setCurrentCol(nextCol)
      } else {
        applyTransform(0, 0, true)
      }

      setTimeout(() => {
        lockedRef.current = false
      }, ANIM_MS + 20)
    } else if (axisRef.current === 'y') {
      const passed =
        Math.abs(dy) > H() * DRAG_THRESHOLD ||
        Math.abs(vy) > VELOCITY_THRESHOLD

      const subCount = GRID[currentCol].pages.length
      let nextRow = currentRow
      if (passed) {
        if (dy < 0) nextRow = Math.min(currentRow + 1, subCount - 1)
        if (dy > 0) nextRow = Math.max(currentRow - 1, 0)
      }

      if (nextRow !== currentRow) {
        if (trackRef.current) {
          trackRef.current.style.transition = 'none'
          trackRef.current.style.transform =
            `translate3d(${-currentCol * W()}px, ${-nextRow * H()}px, 0)`
        }
        void trackRef.current.offsetWidth
        setPageIndexByCol((prev) => {
          const next = [...prev]
          next[currentCol] = nextRow
          return next
        })
      } else {
        applyTransform(0, 0, true)
      }
    } else {
      applyTransform(0, 0, true)
    }

    axisRef.current = null
  }

  // ---- Animate on col/row change ----
  useEffect(() => {
    applyTransform(0, 0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol, currentRow])

  // ---- Sync side tab visibility on col change ----
  useEffect(() => {
    if (!sideTabRef.current) return
    const visible = currentCol === SIDE_TAB_COL
    sideTabRef.current.style.pointerEvents = visible ? 'auto' : 'none'
    sideTabRef.current.setAttribute('aria-hidden', visible ? 'false' : 'true')
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
    applyTransform(0, 0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol, currentRow])

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

  return (
    <div className="launcher">
      {/* ===== 2D track ===== */}
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
            return (
              <div
                key={col.id}
                className="column"
                style={{
                  flex: '0 0 100vw',
                  width: '100vw',
                  height: `${col.pages.length * 100}vh`,
                  position: 'relative',
                }}
              >
                {col.pages.map((pageMeta, rowIndex) => (
                  <div
                    key={pageMeta.id}
                    className="page"
                    style={{
                      background: pageMeta.color,
                      position: 'absolute',
                      top: `${rowIndex * 100}vh`,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                    }}
                  >
                    <div className="page-label">
                      {pageMeta.label}
                      <span className="page-counter">
                        {rowIndex + 1} / {col.pages.length}
                      </span>
                    </div>

                    <div className="app-grid" key={pageMeta.id}>
                      {appsByPage[pageMeta.id].map((app) => (
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
                ))}
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
