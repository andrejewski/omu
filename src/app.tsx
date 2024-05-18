import * as React from 'react'
import { Change, Dispatch } from 'raj-ts'
import {
  Subscription,
  mapSubscription,
  withSubscriptions,
} from 'raj-ts/lib/subscription'

type Point = { x: number; y: number }
type Splat = Point & { base: number; extra: number }
type SizedPoint = Point & { size: number }

type Model = {
  scene: 'home' | 'about' | 'game' | 'game-over'
  score: number
  windowSize: Size
  wheelCanvas: React.RefObject<HTMLCanvasElement>
  bottleRef: React.RefObject<HTMLImageElement>
  wheelColor: string
  wheelRotation: number
  levelStart: number

  previousWallColor: Rgb
  wallProgress: number
  nextWallColor: Rgb

  ketchupPaths: Splat[][]
  cursorPosition: Point
  drawing: boolean
  dishId: string
  lastTick: number
  squeezeDone: boolean
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

const defaultColor: Rgb = [255, 255, 255]

const init: Change<Msg, Model> = [
  {
    scene: 'home',
    score: 0,
    windowSize: { width: 0, height: 0 },
    wheelCanvas: React.createRef(),
    bottleRef: React.createRef(),
    wheelColor: '#000000',
    wheelRotation: 0,
    levelStart: 0,

    previousWallColor: defaultColor,
    nextWallColor: defaultColor,
    wallProgress: 0,

    ketchupPaths: [],
    cursorPosition: { x: 0, y: 0 },
    drawing: false,
    dishId: crypto.randomUUID(),
    lastTick: 0,
    squeezeDone: false,
  },
]

function setUpCanvas(model: Model): [HTMLCanvasElement, number] | undefined {
  const { wheelCanvas } = model
  const canvas = wheelCanvas.current
  if (!canvas) {
    return
  }

  const { width, height } = model.windowSize
  const minSize = Math.min(width, height)
  const xSize = Math.floor(
    width < height
      ? Math.min(minSize * 0.75, height)
      : Math.min(minSize * 0.75, width)
  )

  if (canvas.width === xSize * 2) {
    return [canvas, xSize]
  }

  drawScene(model, canvas, xSize)
  return [canvas, xSize]
}

function drawScene(model: Model, canvas: HTMLCanvasElement, size: number) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
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
  const chunkCount = 2
  const lineWidthScalar = 1.5

  for (let s = 0; s < model.ketchupPaths.length; s++) {
    const relativeSegment = model.ketchupPaths[s]
    const segment = relativeSegment.map(
      (k): SizedPoint => ({
        x: k.x * size,
        y: k.y * size,
        size: (k.base + k.extra) * (size / 40),
      })
    )

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
    }

    // const firstPoint = segment[0]
    // if (!firstPoint) {
    //   continue
    // }

    // ctx.beginPath()
    // ctx.ellipse(
    //   firstPoint.x,
    //   firstPoint.y,
    //   firstPoint.size,
    //   firstPoint.size * 0.4,
    //   0,
    //   0,
    //   2 * Math.PI
    // )
    // ctx.fill()

    // if (segment.length <= 2) {
    //   continue
    // }

    // let lastSize = firstPoint.size

    // ctx.beginPath()
    // ctx.moveTo(firstPoint.x, firstPoint.y)
    // let i = 1
    // let c = 1
    // for (; i < segment.length - 2; i++) {
    //   c++
    //   const point = segment[i]!
    //   const nextPoint = segment[i + 1]!

    //   const midX = (point.x + nextPoint.x) / 2
    //   const midY = (point.y + nextPoint.y) / 2

    //   ctx.quadraticCurveTo(point.x, point.y, midX, midY)

    //   ctx.lineWidth = lineWidthScalar * (point.size + lastSize / 2)
    //   ctx.stroke()
    //   ctx.closePath()
    //   ctx.beginPath()

    //   lastSize = point.size
    // }

    // const secondToLastPoint = segment[i]!
    // const lastPoint = segment[i + 1]!
    // ctx.quadraticCurveTo(
    //   secondToLastPoint.x,
    //   secondToLastPoint.y,
    //   lastPoint.x,
    //   lastPoint.y
    // )
    // ctx.lineWidth = lineWidthScalar * (lastSize + secondToLastPoint.size / 2)
    // ctx.stroke()

    // ctx.beginPath()
    // const radius = lastPoint.size
    // ctx.ellipse(
    //   lastPoint.x,
    //   lastPoint.y,
    //   radius,
    //   radius * 0.4,
    //   0,
    //   0,
    //   2 * Math.PI
    // )
    // ctx.fill()
  }

  // for (const k of model.ketchupPoints) {
  //   ctx.beginPath()
  //   ctx.arc(k.x * size, k.y * size, k.size * (size / 50), 0, 2 * Math.PI)
  //   ctx.fill()
  // }
}

type Rgb = readonly [number, number, number]

function updatePaths(model: Model, delta: number) {
  const canvas = model.wheelCanvas.current
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
      previousPoint.extra += Math.random() / 15 / c

      if (c === 1) {
        samePoint = true
      }
    }
  }

  if (samePoint) {
    return
  }

  const lastSize = lastPath.at(-1)?.base || Math.random() * 0.5 + 0.5
  const minorNegativeSkew = (Math.random() - 0.525) / 10
  const newBase = lastSize + minorNegativeSkew

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
          score: 0,
          levelStart: Date.now(),
          wallProgress: 0,
        },
      ]
    }
    case 'open_about': {
      return [{ ...model, scene: 'about' }]
    }
    case 'return_home': {
      return [
        {
          ...init[0],
          windowSize: model.windowSize,
          wheelCanvas: model.wheelCanvas,
        },
      ]
    }
    case 'window_size': {
      const newModel = { ...model, windowSize: msg.size }

      setUpCanvas(newModel)
      return [newModel]
    }
    case 'draw_tick': {
      if (model.scene !== 'home') {
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
      const canvas = model.wheelCanvas.current
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
    default:
      return [model]
  }
}

function view(model: Model, dispatch: Dispatch<Msg>) {
  ;(window as any).$model = model

  let title
  let footerText
  switch (model.scene) {
    case 'about':
      title = 'About Maid Cafe Omurice Simulator'
      footerText = (
        <button onClick={() => dispatch({ type: 'return_home' })}>
          Back to game
        </button>
      )
      break
    case 'game':
      title = `Match ${model.score + 1}`
      footerText = `${((1 - model.wallProgress) * 100).toFixed(0)}%`
      break
    case 'game-over':
      title = (
        <span onClick={() => dispatch({ type: 'return_home' })}>Game Over</span>
      )
      footerText = `Final score: ${model.score}`
      break
    case 'home':
      title = 'Maid Cafe Omurice Simulator'
      footerText = (
        <button onClick={() => dispatch({ type: 'open_about' })}>
          What's this?
        </button>
      )
      break
  }

  const bottleElement = model.bottleRef.current
  const bottleBounds = bottleElement?.getBoundingClientRect()

  const bottleSelfAdjustmentX = bottleBounds ? -(bottleBounds.width / 2) : 0
  const bottleSelfAdjustmentY = bottleBounds ? -(bottleBounds.height + 20) : 0

  const bottleTop = model.cursorPosition.y + bottleSelfAdjustmentY
  const bottleBottom = model.cursorPosition.x + bottleSelfAdjustmentX

  return (
    <div
      className="app"
      onMouseMove={(e) =>
        dispatch({ type: 'mouse_move', x: e.clientX, y: e.clientY })
      }
    >
      <div className="header">
        <h1>{title}</h1>
      </div>
      <div className="footer">
        <h1>{footerText}</h1>
      </div>

      <div
        key={model.dishId}
        className="main-area"
        onMouseDown={(e) => {
          dispatch({
            type: 'mouse_down',
            x: e.clientX,
            y: e.clientY,
          })
        }}
        onMouseUp={(e) => {
          dispatch({
            type: 'mouse_up',
            x: e.clientX,
            y: e.clientY,
          })
        }}
      >
        <canvas
          id="canvas"
          style={{
            opacity: model.scene === 'about' ? 0.1 : undefined,
          }}
          ref={model.wheelCanvas}
        />
      </div>

      <div className="button-set">
        <button onClick={() => dispatch({ type: 'reset' })}>Another one</button>
        <button onClick={() => dispatch({ type: 'download' })}>Download</button>
      </div>

      <div
        id="hand"
        style={{
          top: `${bottleTop}px`,
          left: `${bottleBottom}px`,
        }}
      >
        <img alt="" id="bottle" src={'./bottle.png'} ref={model.bottleRef} />
        {model.drawing && (
          <img
            alt=""
            id="spray"
            src="./spray.png"
            className={model.squeezeDone ? 'spray-squeeze-exit' : undefined}
            style={{
              // We flip the spray back and forth to flow of ketchup
              transform:
                (Date.now() / 100) % 2 > 1 ? 'scale(-1, 1)' : undefined,
            }}
          />
        )}
      </div>

      {model.scene === 'about' && (
        <div className="about">
          <p>
            Omurice is a Japanese dish that allows one's true creative to be
            expressed before it is eaten. Draw your favorite person, place, or
            thing in ketchup and take the photo home with you.
          </p>

          <p>
            Made by <a href="https://jew.ski">Chris Andrejewski</a>
          </p>
        </div>
      )}
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
