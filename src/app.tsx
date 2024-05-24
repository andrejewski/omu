import * as React from 'react'
import { Change, Dispatch } from 'raj-ts'
import {
  Subscription,
  mapSubscription,
  withSubscriptions,
} from 'raj-ts/lib/subscription'
import { Content, Locale, getContent } from './content'

type Point = { x: number; y: number }
type Splat = Point & { base: number; extra: number }
type SizedPoint = Point & { size: number }

type Model = {
  scene: 'home' | 'about' | 'game'
  windowSize: Size
  drawCanvas: React.RefObject<HTMLCanvasElement>
  cursorRef: React.RefObject<HTMLImageElement>
  ketchupPaths: Splat[][]
  cursorPosition: Point
  drawing: boolean
  dishId: string
  lastTick: number
  squeezeDone: boolean
  touch: boolean
  locale: Locale
  content: Content
}

type Msg =
  | { type: 'start_game' }
  | { type: 'reset' }
  | { type: 'download' }
  | { type: 'mouse_down'; x: number; y: number }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'mouse_up'; x: number; y: number }
  | { type: 'open_about' }
  | { type: 'return_home' }
  | { type: 'draw_tick'; delta: number }
  | { type: 'window_size'; size: Size }
  | { type: 'locale_change'; locale: Locale }

function parseLocale(language: string): Locale {
  return language.startsWith('ja') ? 'ja-JP' : 'en-US'
}

const initialLocale = parseLocale(
  window.localStorage.getItem('locale') || navigator.language
)
const initialContent = getContent(initialLocale)
const init: Change<Msg, Model> = [
  {
    scene: 'home',
    windowSize: { width: 0, height: 0 },
    drawCanvas: React.createRef(),
    cursorRef: React.createRef(),
    ketchupPaths: [],
    cursorPosition: { x: 0, y: 0 },
    drawing: false,
    dishId: crypto.randomUUID(),
    lastTick: 0,
    squeezeDone: true,
    touch: 'ontouchstart' in window,
    locale: initialLocale,
    content: initialContent,
  },
  () => {
    updatePageInfo(initialContent)
  },
]

function updatePageInfo(content: Content) {
  const { title, description } = content
  document.title = title

  const metaUpdates = [
    ['description', description],
    ['og:title', title],
    ['twitter:title', title],
    ['twitter:description', description],
    [],
  ] as [string, string][]

  for (const [name, value] of metaUpdates) {
    document
      .querySelector(`meta[name="${name}"]`)
      ?.setAttribute('content', value)

    document
      .querySelector(`meta[property="${name}"]`)
      ?.setAttribute('content', value)
  }
}

function setUpCanvas(model: Model): [HTMLCanvasElement, number] | undefined {
  const { drawCanvas } = model
  const canvas = drawCanvas.current
  if (!canvas) {
    return
  }

  const { width, height } = model.windowSize
  const minSize = Math.min(width, height)
  const screenCanvasMargin = 0.05
  const canvasSize = minSize * (1 - screenCanvasMargin)

  const xSize = Math.floor(
    width < height ? Math.min(canvasSize, height) : Math.min(canvasSize, width)
  )

  if (canvas.width === xSize * 2) {
    return [canvas, xSize]
  }

  drawScene(model, canvas, xSize)
  return [canvas, xSize]
}

function drawScene(model: Model, canvas: HTMLCanvasElement, size: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  size = size * 2

  canvas.width = size
  canvas.height = size

  // dish bottom
  ctx.beginPath()
  ctx.fillStyle = 'rgb(222 228 227)'
  ctx.ellipse(
    size / 2,
    size / 2 + size * 0.05,
    size / 2.5,
    size / 4.5,
    0,
    0,
    2 * Math.PI
  )
  ctx.fill()

  // dish top
  ctx.beginPath()
  ctx.fillStyle = 'rgb(234 240 239)'
  ctx.ellipse(size / 2, size / 2, size / 2, size / 4, 0, 0, 2 * Math.PI)
  ctx.fill()

  // dish hole
  ctx.beginPath()
  ctx.fillStyle = 'rgb(232 236 235)'
  ctx.ellipse(size / 2, size / 2, size / 2.2, size / 4.2, 0, 0, 2 * Math.PI)
  ctx.fill()

  // rice base
  ctx.beginPath()
  ctx.fillStyle = '#f68c39'
  ctx.ellipse(
    size / 2,
    size / 2 - size * 0.02,
    size / 2.2,
    size / 5,
    0,
    0,
    2 * Math.PI
  )
  ctx.fill()

  // egg
  ctx.beginPath()
  ctx.fillStyle = '#efca57'
  ctx.ellipse(
    size / 2,
    size / 2 - size * 0.05,
    size / 2.2,
    size / 5.5,
    0,
    0,
    2 * Math.PI
  )
  ctx.fill()

  if (!model.ketchupPaths.length) {
    return
  }

  ctx.fillStyle = '#FB5A59'
  ctx.strokeStyle = '#FB5A59'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  for (let s = 0; s < model.ketchupPaths.length; s++) {
    const relativeSegment = model.ketchupPaths[s]
    const segment = relativeSegment.map(
      (k): SizedPoint => ({
        x: k.x * size,
        y: k.y * size,
        size: (k.base + k.extra) * (size / 40),
      })
    )

    // Since it's ellipsis, we smooth out larger vertical changes with another point
    let previousPoint
    for (const point of segment) {
      ctx.beginPath()
      ctx.ellipse(
        point.x,
        point.y,
        point.size,
        point.size * 0.4,
        0,
        0,
        2 * Math.PI
      )
      ctx.fill()

      if (previousPoint) {
        const verticalMove = Math.abs(point.y - previousPoint.y) > 0.01
        if (verticalMove) {
          const midX = (point.x + previousPoint.x) / 2
          const midY = (point.y + previousPoint.y) / 2
          const midSize = (point.size + previousPoint.size) / 2

          ctx.beginPath()
          ctx.ellipse(midX, midY, midSize, midSize * 0.4, 0, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      previousPoint = point
    }
  }
}

function updatePaths(model: Model, delta: number) {
  const canvas = model.drawCanvas.current
  if (!canvas) {
    return
  }

  const bounds = canvas.getBoundingClientRect()

  const { x, y } = model.cursorPosition
  const newPointX = (x - bounds.left) / bounds.width
  const newPointY = (y - bounds.top) / bounds.height

  let lastPath = model.ketchupPaths.at(-1)
  if (!lastPath) {
    return
  }

  let samePoint = false

  let c = 0
  for (let i = lastPath.length - 1; i > 0; i--) {
    c++
    const previousPoint = lastPath[i]
    const minimumDistThreshold = c * 0.00125 // 0.0003125

    const distX = Math.abs(newPointX - previousPoint.x)
    const distY = Math.abs(newPointY - previousPoint.y)
    if (distX < minimumDistThreshold && distY < minimumDistThreshold) {
      const newExtra = Math.random() / 15 / c
      if (c === 1) {
        samePoint = true
        if (previousPoint.extra > previousPoint.base) {
          previousPoint.extra +=
            newExtra / previousPoint.extra / previousPoint.base / 2
          continue
        }
      }

      previousPoint.extra += newExtra
    }
  }

  if (samePoint) {
    return
  }

  const lastPointBase = lastPath.at(-1)?.base
  const initialBase = lastPointBase || Math.random() * 0.4 + 0.6

  // Some amount of negative skew to trend towards running out of ketchup
  const minorNegativeSkew = (Math.random() - 0.525) / 10

  // Some negative skew to trend towards finishing squeezes that may be going long
  // const durationNegativeSkew = -(lastPath.length * 0.00005)

  const newBase = initialBase + minorNegativeSkew // + durationNegativeSkew

  // We get the drizzle to taper off
  if (newBase < 0.25) {
    const toss = Math.random()

    if (toss < 0.05) {
      model.squeezeDone = true
    }

    if (toss > 0.5) {
      return
    }
  }

  if (newBase < 0.2) {
    return
  }

  const newPoint: Splat = {
    x: newPointX,
    y: newPointY,
    base: newBase,
    extra: 0,
  }

  lastPath.push(newPoint)
}

function update(msg: Msg, model: Model): Change<Msg, Model> {
  switch (msg.type) {
    case 'start_game': {
      return [
        {
          ...model,
          scene: 'game',
        },
      ]
    }
    case 'open_about': {
      return [{ ...model, scene: 'about' }]
    }
    case 'return_home': {
      return [
        {
          ...model,
          scene: 'home',
          windowSize: model.windowSize,
          drawCanvas: model.drawCanvas,
        },
      ]
    }
    case 'window_size': {
      const newModel = { ...model, windowSize: msg.size }

      setUpCanvas(newModel)
      return [newModel]
    }
    case 'draw_tick': {
      if (model.scene !== 'game') {
        return [model]
      }

      const currentTick = Date.now()
      const delta = currentTick - model.lastTick
      if (delta < 10) {
        return [model]
      }

      const r = setUpCanvas(model)
      if (!r) {
        return [model]
      }
      const [canvas, size] = r

      if (model.drawing && !model.squeezeDone) {
        updatePaths(model, delta)
      }

      drawScene(model, canvas, size)
      return [{ ...model, lastTick: currentTick }]
    }
    case 'mouse_move': {
      const { x, y } = msg
      return [{ ...model, cursorPosition: { x, y } }]
    }
    case 'mouse_down': {
      const { x, y } = msg
      model.ketchupPaths.push([])
      return [
        {
          ...model,
          drawing: true,
          squeezeDone: false,
          cursorPosition: { x, y },
        },
      ]
    }
    case 'mouse_up': {
      return [{ ...model, drawing: false, squeezeDone: true }]
    }
    case 'reset': {
      return [{ ...model, dishId: crypto.randomUUID(), ketchupPaths: [] }]
    }
    case 'download': {
      const canvas = model.drawCanvas.current
      if (!canvas) {
        return [model]
      }

      const imageDataUrl = canvas.toDataURL()
      const downloadEffect = () => {
        const a = document.createElement('a')
        a.href = imageDataUrl
        a.download = `omurice-${new Date()
          .toLocaleTimeString()
          .replaceAll(' ', '_')}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }

      return [model, downloadEffect]
    }
    case 'locale_change': {
      try {
        window.localStorage.setItem('locale', msg.locale)
      } catch {}

      const content = getContent(msg.locale)
      updatePageInfo(content)

      return [{ ...model, locale: msg.locale, content }]
    }
    default:
      return [model]
  }
}

function view(model: Model, dispatch: Dispatch<Msg>) {
  ;(window as any).$model = model

  switch (model.scene) {
    case 'home':
      return homeView(model, dispatch)
    case 'about':
      return aboutView(model, dispatch)
    case 'game':
      break
  }

  const bottleElement = model.cursorRef.current
  const bottleBounds = bottleElement?.getBoundingClientRect()

  const bottleSelfAdjustmentX = bottleBounds ? -(bottleBounds.width / 2) : 0
  const bottleSelfAdjustmentY = bottleBounds ? -(bottleBounds.height + 20) : 0

  const bottleTop = model.cursorPosition.y + bottleSelfAdjustmentY
  const bottleBottom = model.cursorPosition.x + bottleSelfAdjustmentX

  return (
    <div
      className="app"
      {...(model.touch
        ? {
            onTouchMove(e) {
              const firstTouch = e.changedTouches.item(0)
              if (!firstTouch) {
                return
              }

              dispatch({
                type: 'mouse_move',
                x: firstTouch.clientX,
                y: firstTouch.clientY,
              })
            },
          }
        : {
            onMouseMove(e) {
              dispatch({ type: 'mouse_move', x: e.clientX, y: e.clientY })
            },
          })}
      {...(model.touch
        ? {
            onTouchStart(e) {
              const firstTouch = e.changedTouches.item(0)
              if (!firstTouch) {
                return
              }

              dispatch({
                type: 'mouse_down',
                x: firstTouch.clientX,
                y: firstTouch.clientY,
              })
            },
            onTouchEnd(e) {
              const firstTouch = e.changedTouches.item(0)
              if (!firstTouch) {
                return
              }

              dispatch({
                type: 'mouse_up',
                x: firstTouch.clientX,
                y: firstTouch.clientY,
              })
            },
          }
        : {
            onMouseDown(e) {
              dispatch({
                type: 'mouse_down',
                x: e.clientX,
                y: e.clientY,
              })
            },
            onMouseUp(e) {
              dispatch({
                type: 'mouse_up',
                x: e.clientX,
                y: e.clientY,
              })
            },
          })}
    >
      <div className="toolbar">
        <div className="toolbar-bar">
          <h1>{model.content.title}</h1>
          <div className="toolbar-buttons">
            <button onClick={() => dispatch({ type: 'reset' })}>
              {model.content.anotherOneButton}
            </button>
            <button onClick={() => dispatch({ type: 'download' })}>
              {model.content.downloadButton}
            </button>
          </div>
        </div>
      </div>

      <div key={model.dishId} className="main-area">
        <canvas id="canvas" ref={model.drawCanvas} />
      </div>

      <div
        id="hand"
        style={{
          top: `${bottleTop}px`,
          left: `${bottleBottom}px`,
        }}
      >
        <img alt="" id="bottle" src={'./bottle.png'} ref={model.cursorRef} />
        <div className="spray-bottom">
          <div
            className="spray-shadow"
            style={{ opacity: model.drawing ? 0 : undefined }}
          />
          <img
            alt=""
            className="spray-ghost"
            src="./spray.png"
            style={{
              visibility: 'hidden',
            }}
          />
          <img
            alt=""
            src="./spray.png"
            className={
              model.squeezeDone
                ? 'spray-sauce spray-squeeze-exit'
                : 'spray-sauce'
            }
            style={{
              position: 'absolute',
              top: 0,
              // We flip the spray back and forth to flow of ketchup
              transform:
                model.drawing && (Date.now() / 100) % 2 > 1
                  ? 'scale(-1, 1)'
                  : undefined,
            }}
          />
        </div>
      </div>
    </div>
  )
}

function homeView(model: Model, dispatch: Dispatch<Msg>) {
  return (
    <div className="home">
      <h1>{model.content.title}</h1>

      <div className="locale-picker">
        <p>{model.content.selectLanguageButton}</p>
        {(
          [
            ['en-US', 'English'],
            ['ja-JP', '日本語'],
          ] as [Locale, string][]
        ).map(([locale, name]) => (
          <button
            className={model.locale === locale ? 'active' : undefined}
            onClick={() => dispatch({ type: 'locale_change', locale })}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="button-set">
        <button onClick={() => dispatch({ type: 'start_game' })}>
          {model.content.startGameButton}
        </button>
        <button onClick={() => dispatch({ type: 'open_about' })}>
          {model.content.aboutGameButton}
        </button>
      </div>

      <img alt="" id="home-bottle" src="./bottle.png" />
    </div>
  )
}

function aboutView(model: Model, dispatch: Dispatch<Msg>) {
  return (
    <div className="about-napkin">
      <div className="about">
        <div className="about-content">{model.content.aboutPageContent}</div>

        <button
          className="about-button"
          onClick={() => dispatch({ type: 'return_home' })}
        >
          {model.content.returnToHomeButton}
        </button>
      </div>

      <img
        alt=""
        id="home-bottle"
        style={{
          opacity: '0.4',
          zIndex: -100,
          zoom: '0.4',
          right: '15vmax',
        }}
        src="./bottle.png"
      />
    </div>
  )
}

function rafSub(): Subscription<number> {
  let request: number
  let lastTickedAt = Date.now()

  return {
    effect: (dispatch: Dispatch<number>) => {
      request = requestAnimationFrame(function loop() {
        const tick = Date.now()
        dispatch(tick - lastTickedAt)
        lastTickedAt = tick
        request = requestAnimationFrame(loop)
      })
    },
    cancel() {
      cancelAnimationFrame(request)
    },
  }
}

type Size = { width: number; height: number }

function sizeSub(): Subscription<Size> {
  let listener: () => void

  return {
    effect(dispatch: Dispatch<Size>) {
      listener = () => {
        dispatch({
          width: window.innerWidth,
          height: window.innerHeight,
        })
      }

      window.addEventListener('resize', listener)
      listener()
    },
    cancel() {
      if (listener) {
        window.removeEventListener('resize', listener)
      }
    },
  }
}

function subscriptions(model: Model) {
  return {
    tick: () =>
      mapSubscription(
        rafSub(),
        (delta) => ({ type: 'draw_tick', delta } as const)
      ),
    size: () =>
      mapSubscription(
        sizeSub(),
        (size) => ({ type: 'window_size', size } as const)
      ),
  }
}

export const appProgram = withSubscriptions({
  init,
  update,
  view,
  subscriptions,
})
