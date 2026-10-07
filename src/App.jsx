import { useState, useEffect, useRef } from 'react'
import './App.css'

const GRID = [
  {
    id: 'col-0',
    pages: [
      { id: '1a', label: 'Page 1a', wallpaper: "url('/wallpaper-1a.jpg')" },
      { id: '1b', label: 'Page 1b', wallpaper: "url('/wallpaper-1b.jpg')" },
      { id: '1c', label: 'Page 1c', wallpaper: "url('/wallpaper-1c.jpg')" },
    ],
    boundaries: [
      { id: 'a-b', from: 0, to: 1, topVh: 155, rectHeightVh: 100, slopeY: 0.40, slopeX: 1.00 },
      { id: 'b-a', from: 1, to: 0, topVh: 55, rectHeightVh: 100, slopeY: 0.40, slopeX: 1.00 },
      { id: 'b-c', from: 1, to: 2, topVh: 155, rectHeightVh: 100, slopeY: 0.40, slopeX: 1.00 },
      { id: 'c-b', from: 2, to: 1, topVh: 55, rectHeightVh: 100, slopeY: 0.40, slopeX: 1.00 },
    ],
    rectangles: [
      { id: 'rect-1', topVh: 55, heightVh: 100, variant: 'upper' },
      { id: 'rect-2', topVh: 60, heightVh: 100, variant: 'lower' },
      { id: 'rect-3', topVh: 155, heightVh: 100, variant: 'upper' },
      { id: 'rect-4', topVh: 160, heightVh: 100, variant: 'lower' },
    ],
    dates: [{ id: 'date-1', topVh: 90, align: 'left' }],
  },
  {
    id: 'col-1',
    pages: [{ id: '2', label: 'Page 2', wallpaper: null }],
    boundaries: [],
  },
  {
    id: 'col-2',
    pages: [{ id: '3', label: 'Page 3', wallpaper: null }],
    boundaries: [],
  },
]

const SIDE_TAB_COL = 0

const DRAG_THRESHOLD = 0.2
const VELOCITY_THRESHOLD = 0.5
const ANIM_MS = 350
const AXIS_LOCK_PX = 8

// Hidden clip-path so the reveal layer stays mounted but paints nothing
const HIDDEN_CLIP = 'polygon(0 0, 0 0, 0 0, 0 0)'

// ==================================================
// HELPERS
// ==================================================
function stripUrl(w) {
  if (!w) return ''
  const m = w.match(/url\(['"]?(.+?)['"]?\)/)
  return m ? m[1] : w
}

function findBoundary(col, from, to) {
  if (!col.boundaries) return null
  return col.boundaries.find((b) => b.from === from && b.to === to) || null
}

// ==================================================
// HOOKS
// ==================================================
function useDateInfo() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return {
    dayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
    dateStr: now.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric',
    }),
  }
}

function useSlopeAngle({ slopeY = 0.40, slopeX = 1.00, heightVh = 100 } = {}) {
  const [angle, setAngle] = useState(-28)
  useEffect(() => {
    const compute = () => {
      const W = window.innerWidth
      const H = (heightVh / 100) * window.innerHeight
      const dy = slopeY * H
      const dx = slopeX * W
      if (dx === 0 || dy === 0) return
      setAngle(-Math.atan(dy / dx) * (180 / Math.PI))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [slopeY, slopeX, heightVh])
  return angle
}

// ==================================================
// DATE LABEL
// ==================================================
function DateLabel({ topVh = 0, align = 'left', slopeY = 0.40, slopeX = 1.00, referenceHeightVh = 100 }) {
  const { dayName, dateStr } = useDateInfo()
  const angle = useSlopeAngle({ slopeY, slopeX, heightVh: referenceHeightVh })
  return (
    <div
      className={`date-label date-label-${align}`}
      style={{ top: `${topVh}vh`, transform: `rotate(${angle}deg)` }}
      aria-hidden="true"
    >
      <div className="date-label-day">{dayName}</div>
      <div className="date-label-date">{dateStr}</div>
    </div>
  )
}

// ==================================================
// COLUMN RECTANGLE
// ==================================================
function ColumnRectangle({ topVh = 0, heightVh = 200, variant = 'upper' }) {
  return (
    <div
      className={`column-rect column-rect-${variant}`}
      style={{ top: `${topVh}vh`, height: `${heightVh}vh` }}
      aria-hidden="true"
    >
      <div className="column-rect-bg" />
    </div>
  )
}

// ==================================================
// SIDE TAB
// ==================================================
function SideTab({ innerRef, visible, dockCount, dockIndex, onDockClick }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeStr = now.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return (
    <div className="side-tab" ref={innerRef} aria-hidden={!visible}>
      <div className="side-tab-rail" />
      <div className="side-tab-content">
        <div className="side-avatar"><span>◐</span></div>
        <div className="side-clock">{timeStr}</div>
        <div className="side-battery">
          <span>55%</span>
          <span className="side-battery-icon">▯</span>
        </div>
        <div className="side-meta">Made by Ktone1666</div>
        <div className="side-divider" />
        <div className="side-dock">
          {Array.from({ length: dockCount }).map((_, i) => (
            <button
              key={i}
              className={'side-dock-btn' + (i === dockIndex ? ' active' : '')}
              aria-label={`Dock item ${i + 1}`}
              tabIndex={visible ? 0 : -1}
              onClick={() => onDockClick(i)}
            >
              {String.fromCharCode(65 + i)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================================================
// APP
// ==================================================
function App() {
  const [apps, setApps] = useState([])
  const [currentCol, setCurrentCol] = useState(0)
  const [pageIndexByCol, setPageIndexByCol] = useState(() =>
    GRID.map(() => 0)
  )

  // Active boundary id per column during a drag. null = resting.
  const [activeBoundaryByCol, setActiveBoundaryByCol] = useState(() =>
    GRID.map(() => null)
  )

  // Live boundary top position (vh) during drag.
  const [dragBoundaryVhByCol, setDragBoundaryVhByCol] = useState(() =>
    GRID.map(() => null)
  )

  // "Reveal slot" per column: which row index the reveal layer currently
  // targets (above or below the active row). Kept stable between gestures
  // so the reveal layer never swaps image unless the direction changes.
  const [revealRowByCol, setRevealRowByCol] = useState(() =>
    GRID.map(() => 1)
  )

  const trackRef = useRef(null)
  const sideTabRef = useRef(null)

  const wallpaperBaseRefs = useRef([])
  const wallpaperRevealRefs = useRef([])

  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startTimeRef = useRef(0)
  const dragXRef = useRef(0)
  const dragYRef = useRef(0)
  const draggingRef = useRef(false)
  const axisRef = useRef(null)
  const lockedRef = useRef(false)
  const prevColRef = useRef(0)

  const W = () => window.innerWidth
  const H = () => window.innerHeight

  const currentRow = pageIndexByCol[currentCol]
  const isSideTabVisible = currentCol === SIDE_TAB_COL

  // ---- Preload every wallpaper as a live <img> so the browser keeps
  //      the decoded bitmap resident. Prevents first-swipe flash. ----
  useEffect(() => {
    GRID.forEach((col) => {
      col.pages.forEach((p) => {
        if (p.wallpaper) {
          const img = new Image()
          img.src = stripUrl(p.wallpaper)
        }
      })
    })
  }, [])

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

  // ==================================================
  // TRANSFORM HELPERS
  // ==================================================
  const setTrackTransform = (tx, ty, animate) => {
    if (!trackRef.current) return
    const transition = animate
      ? `transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none'

    trackRef.current.style.transition = transition
    trackRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`

    if (sideTabRef.current) {
      sideTabRef.current.style.transition = transition
      const displaced = Math.min(Math.max(tx, -W()), 0)
      sideTabRef.current.style.transform = `translate3d(${displaced}px, 0, 0)`
    }

    // Pin wallpapers to viewport on Y (cancel track Y).
    // X is not cancelled — they slide with the column horizontally.
    const pinY = -ty
    wallpaperBaseRefs.current.forEach((el) => {
      if (!el) return
      el.style.transition = transition
      el.style.transform = `translate3d(0, ${pinY}px, 0)`
    })
    wallpaperRevealRefs.current.forEach((el) => {
      if (!el) return
      el.style.transition = transition
      el.style.transform = `translate3d(0, ${pinY}px, 0)`
    })
  }

  const targetFor = (col, row) => ({
    x: -col * W(),
    y: -row * H(),
  })

  const animateTo = (col, row) => {
    const { x, y } = targetFor(col, row)
    setTrackTransform(x, y, true)
  }

  // ==================================================
  // POINTER HANDLERS
  // ==================================================
  const onPointerDown = (e) => {
    if (lockedRef.current) return
    draggingRef.current = true
    axisRef.current = null
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    startTimeRef.current = performance.now()
    dragXRef.current = 0
    dragYRef.current = 0
    setActiveBoundaryByCol((prev) => prev.map(() => null))
    setDragBoundaryVhByCol((prev) => prev.map(() => null))
    setTrackTransform(-currentCol * W(), -currentRow * H(), false)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return

    let dx = e.clientX - startXRef.current
    let dy = e.clientY - startYRef.current

    if (!axisRef.current) {
      const ax = Math.abs(dx)
      const ay = Math.abs(dy)
      if (ax > AXIS_LOCK_PX || ay > AXIS_LOCK_PX) {
        axisRef.current = ax > ay ? 'x' : 'y'
      }
    }

    if (axisRef.current === 'x') {
      const atStart = currentCol === 0 && dx > 0
      const atEnd = currentCol === GRID.length - 1 && dx < 0
      if (atStart || atEnd) dx *= 0.3
      dy = 0
    } else if (axisRef.current === 'y') {
      const subCount = GRID[currentCol].pages.length
      const atTop = currentRow === 0 && dy > 0
      const atBottom = currentRow === subCount - 1 && dy < 0
      if (atTop || atBottom) dy *= 0.3
      dx = 0

      let targetRow = currentRow
      if (dy < 0 && currentRow < subCount - 1) targetRow = currentRow + 1
      else if (dy > 0 && currentRow > 0) targetRow = currentRow - 1

      if (targetRow !== currentRow) {
        const boundary = findBoundary(GRID[currentCol], currentRow, targetRow)
        if (boundary) {
          setActiveBoundaryByCol((prev) => {
            const next = [...prev]
            next[currentCol] = boundary.id
            return next
          })

          // Update the reveal slot so the reveal layer shows the target page's
          // wallpaper even before committing.
          setRevealRowByCol((prev) => {
            if (prev[currentCol] === targetRow) return prev
            const next = [...prev]
            next[currentCol] = targetRow
            return next
          })

          const boundaryVh = boundary.topVh + (dy / H()) * 100
          setDragBoundaryVhByCol((prev) => {
            const next = [...prev]
            next[currentCol] = boundaryVh
            return next
          })
        }
      }
    } else {
      return
    }

    dragXRef.current = dx
    dragYRef.current = dy

    setTrackTransform(
      -currentCol * W() + dx,
      -currentRow * H() + dy,
      false
    )
  }

  const onPointerUp = () => {
    if (!draggingRef.current) return
    draggingRef.current = false

    const dx = dragXRef.current
    const dy = dragYRef.current
    const dt = performance.now() - startTimeRef.current
    const vx = dx / (dt || 1)
    const vy = dy / (dt || 1)
    const axis = axisRef.current

    // Hoisted so it's available in the commit section below.
    const subCount = GRID[currentCol].pages.length

    let nextCol = currentCol
    let nextRow = currentRow

    if (axis === 'x') {
      const passed =
        Math.abs(dx) > W() * DRAG_THRESHOLD ||
        Math.abs(vx) > VELOCITY_THRESHOLD
      if (passed) {
        if (dx < 0) nextCol = Math.min(currentCol + 1, GRID.length - 1)
        if (dx > 0) nextCol = Math.max(currentCol - 1, 0)
      }
    } else if (axis === 'y') {
      const passed =
        Math.abs(dy) > H() * DRAG_THRESHOLD ||
        Math.abs(vy) > VELOCITY_THRESHOLD
      if (passed) {
        if (dy < 0) nextRow = Math.min(currentRow + 1, subCount - 1)
        if (dy > 0) nextRow = Math.max(currentRow - 1, 0)
      }
    }

    // Commit new row/col and clear the boundary in ONE batch.
    if (nextCol !== currentCol) setCurrentCol(nextCol)
    if (nextRow !== currentRow) {
      setPageIndexByCol((prev) => {
        const next = [...prev]
        next[currentCol] = nextRow
        return next
      })
      // Prepare the reveal slot for the NEXT gesture (pointing back)
      setRevealRowByCol((prev) => {
        const next = [...prev]
        next[currentCol] = Math.max(
          0,
          Math.min(subCount - 1, nextRow + (dy < 0 ? -1 : 1))
        )
        return next
      })
    }

    setActiveBoundaryByCol((prev) => prev.map(() => null))
    setDragBoundaryVhByCol((prev) => prev.map(() => null))

    animateTo(nextCol, nextRow)

    if (nextCol !== currentCol || nextRow !== currentRow) {
      lockedRef.current = true
      setTimeout(() => {
        lockedRef.current = false
      }, ANIM_MS + 20)
    }

    dragXRef.current = 0
    dragYRef.current = 0
    axisRef.current = null
  }

  useEffect(() => {
    const { x, y } = targetFor(currentCol, currentRow)
    setTrackTransform(x, y, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol, currentRow])

  useEffect(() => {
    if (!sideTabRef.current) return
    const visible = currentCol === SIDE_TAB_COL
    sideTabRef.current.style.pointerEvents = visible ? 'auto' : 'none'
  }, [currentCol])

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

  useEffect(() => {
    const onResize = () => {
      const { x, y } = targetFor(currentCol, currentRow)
      setTrackTransform(x, y, false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCol, currentRow])

  const goToCol = (col) => {
    if (lockedRef.current || col === currentCol) return
    lockedRef.current = true
    setCurrentCol(col)
    setTimeout(() => {
      lockedRef.current = false
    }, ANIM_MS + 20)
  }

  const goToSubPage = (colIndex, pageIndex) => {
    setPageIndexByCol((prev) => {
      const next = [...prev]
      next[colIndex] = pageIndex
      return next
    })
  }

  // ==================================================
  // RENDER
  // ==================================================
  return (
    <div className="launcher">
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
            const columnHeightVh = col.pages.length * 100
            const activeRow = pageIndexByCol[colIndex]
            const subCount = col.pages.length

            // --- Layer assignments (both always mounted) ---
            const baseWallpaper = col.pages[activeRow]?.wallpaper

            // The reveal layer's wallpaper: use the "reveal slot" row.
            // Clamp to valid range to avoid undefined.
            const revealRow = Math.max(
              0,
              Math.min(subCount - 1, revealRowByCol[colIndex] ?? 0)
            )
            const revealWallpaper =
              col.pages[revealRow]?.wallpaper ||
              baseWallpaper // fallback: same as base so nothing flashes

            // --- Clip-path for reveal layer ---
            const activeBoundaryId = activeBoundaryByCol[colIndex]
            const activeBoundary = activeBoundaryId
              ? col.boundaries?.find((b) => b.id === activeBoundaryId)
              : null
            const dragBoundaryVh = dragBoundaryVhByCol[colIndex]

            let revealClip = HIDDEN_CLIP

            if (activeBoundary && dragBoundaryVh !== null) {
              const slopePctVh =
                activeBoundary.slopeY * activeBoundary.rectHeightVh
              const edgeLeft = dragBoundaryVh
              const edgeRight = dragBoundaryVh - slopePctVh
              const swipingUp = activeBoundary.to > activeBoundary.from

              if (swipingUp) {
                revealClip = `polygon(
                  0vh ${edgeLeft}vh,
                  100vw ${edgeRight}vh,
                  100vw 100vh,
                  0vh 100vh
                )`
              } else {
                revealClip = `polygon(
                  0vh 0vh,
                  100vw 0vh,
                  100vw ${edgeRight}vh,
                  0vh ${edgeLeft}vh
                )`
              }
            }

            return (
              <div
                key={col.id}
                className="column"
                style={{
                  flex: '0 0 100vw',
                  width: '100vw',
                  height: `${columnHeightVh}vh`,
                  position: 'relative',
                }}
              >
                {/* Base wallpaper — only rendered if this column has one.
                    Columns without a wallpaper stay fully transparent. */}
                {baseWallpaper && (
                  <div
                    ref={(el) => (wallpaperBaseRefs.current[colIndex] = el)}
                    className="column-wallpaper column-wallpaper-base"
                    style={{ backgroundImage: baseWallpaper }}
                    aria-hidden="true"
                  />
                )}

                {/* Reveal wallpaper — only rendered if we have one to show.
                    Kept mounted with a hidden clip-path when idle so the
                    diagonal reveal can animate without a remount flash. */}
                {revealWallpaper && (
                  <div
                    ref={(el) => (wallpaperRevealRefs.current[colIndex] = el)}
                    className="column-wallpaper column-wallpaper-reveal"
                    style={{
                      backgroundImage: revealWallpaper,
                      clipPath: revealClip,
                      WebkitClipPath: revealClip,
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Pages — transparent content */}
                {col.pages.map((pageMeta, rowIndex) => (
                  <div
                    key={pageMeta.id}
                    className="page"
                    style={{
                      position: 'absolute',
                      top: `${rowIndex * 100}vh`,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      zIndex: 2,
                      background: 'transparent',
                    }}
                  >
                    <div className="page-label">{pageMeta.label}</div>
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

                {/* Rectangles */}
                {col.rectangles &&
                  col.rectangles.map((rect) => (
                    <ColumnRectangle
                      key={rect.id}
                      topVh={rect.topVh}
                      heightVh={rect.heightVh}
                      variant={rect.variant}
                    />
                  ))}

                {/* Date label */}
                {col.dates &&
                  col.dates.map((d) => {
                    const slopeY = activeBoundary?.slopeY ?? 0.40
                    const slopeX = activeBoundary?.slopeX ?? 1.00
                    return (
                      <DateLabel
                        key={d.id}
                        topVh={d.topVh}
                        align={d.align}
                        slopeY={slopeY}
                        slopeX={slopeX}
                        referenceHeightVh={100}
                      />
                    )
                  })}
              </div>
            )
          })}
        </div>
      </div>

      <SideTab
        innerRef={sideTabRef}
        visible={isSideTabVisible}
        dockCount={3}
        dockIndex={currentRow}
        onDockClick={(i) => goToSubPage(SIDE_TAB_COL, i)}
      />

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
