import * as React from 'react'
import { Change, Dispatch } from 'raj-ts'
import {
  Subscription,
  mapSubscription,
  withSubscriptions,
} from 'raj-ts/lib/subscription'

type Point = { x: number; y: number }
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

  ketchupPaths: SizedPoint[][]
  cursorPosition: Point
  drawing: boolean
  dishId: string
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
  const chunkCount = 5
  const lineWidthScalar = 1.5
  for (let s = 0; s < model.ketchupPaths.length; s++) {
    const relativeSegment = model.ketchupPaths[s]
    const segment = relativeSegment.map(
      (k): SizedPoint => ({
        x: k.x * size,
        y: k.y * size,
        size: k.size * (size / 50),
      })
    )

    ctx.beginPath()
    const firstPoint = segment[0]
    if (!firstPoint) {
      continue
    }

    if (segment.length <= 2) {
      ctx.ellipse(
        firstPoint.x,
        firstPoint.y,
        firstPoint.size,
        firstPoint.size * 0.4,
        0,
        0,
        2 * Math.PI
      )
      ctx.fill()
      continue
    }

    let runningSum = firstPoint.size

    ctx.moveTo(firstPoint.x, firstPoint.y)
    let i = 1
    let c = 1
    for (; i < segment.length - 2; i++) {
      c++
      const point = segment[i]!
      const nextPoint = segment[i + 1]!

      const midX = (point.x + nextPoint.x) / 2
      const midY = (point.y + nextPoint.y) / 2

      ctx.quadraticCurveTo(point.x, point.y, midX, midY)

      runningSum += point.size

      if (c % chunkCount === 0) {
        ctx.lineWidth = lineWidthScalar * (runningSum / chunkCount)
        ctx.stroke()
        ctx.closePath()
        ctx.beginPath()
        runningSum = 0
        i--
      }
    }

    const secondToLastPoint = segment[i]!
    const lastPoint = segment[i + 1]!
    ctx.quadraticCurveTo(
      secondToLastPoint.x,
      secondToLastPoint.y,
      lastPoint.x,
      lastPoint.y
    )
    ctx.lineWidth = lineWidthScalar * (runningSum / (c % chunkCount))
    ctx.stroke()

    const isLastPath = s + 1 === model.ketchupPaths.length
    if (!isLastPath) {
      continue
    }

    let drawTip = lastPoint
    if (drawTip) {
      const radius = model.drawing ? drawTip.size : ctx.lineWidth / 2

      ctx.ellipse(drawTip.x, drawTip.y, radius, radius * 0.4, 0, 0, 2 * Math.PI)
      // ctx.arc(
      //   drawTip.x,
      //   drawTip.y,
      //   model.drawing ? drawTip.size : ctx.lineWidth / 2,
      //   0,
      //   2 * Math.PI
      // )
      ctx.fill()
    }
  }

  // for (const k of model.ketchupPoints) {
  //   ctx.beginPath()
  //   ctx.arc(k.x * size, k.y * size, k.size * (size / 50), 0, 2 * Math.PI)
  //   ctx.fill()
  // }
}

type Rgb = readonly [number, number, number]

function updatePaths(model: Model) {
  const canvas = model.wheelCanvas.current
  if (!canvas) {
    return
  }

  const bounds = canvas.getBoundingClientRect()

  const { x, y } = model.cursorPosition
  const newPoint: SizedPoint = {
    x: (x - bounds.left) / bounds.width,
    y: (y - bounds.top) / bounds.height,
    size: Math.random() * 0.75 + 0.25,
  }

  let lastPath = model.ketchupPaths.at(-1)
  if (!lastPath) {
    lastPath = []
    model.ketchupPaths.push(lastPath)
  }

  const lastPoint = lastPath.at(-1)
  const minimumDistThreshold = 0.00125
  if (lastPoint) {
    const distX = Math.abs(newPoint.x - lastPoint.x)
    const distY = Math.abs(newPoint.y - lastPoint.y)
    if (distX < minimumDistThreshold || distY < minimumDistThreshold) {
      lastPoint.x = newPoint.x
      lastPoint.y = newPoint.y
      lastPoint.size += Math.random() / 10
      return
    }
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

      const r = setUpCanvas(model)
      if (!r) {
        return [model]
      }
      const [canvas, size] = r

      if (model.drawing) {
        updatePaths(model)
      }

      drawScene(model, canvas, size)
      return [model]
    }
    case 'mouse_move': {
      const { x, y } = msg
      return [{ ...model, cursorPosition: { x, y } }]
    }
    case 'mouse_down': {
      const { x, y } = msg
      model.ketchupPaths.push([])
      return [{ ...model, drawing: true, cursorPosition: { x, y } }]
    }
    case 'mouse_up': {
      return [{ ...model, drawing: false }]
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