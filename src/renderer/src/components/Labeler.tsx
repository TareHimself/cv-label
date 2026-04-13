import { styled } from '@linaria/react'
import { clamp } from '@mantine/hooks'
import { LabelerStore, normalizeAnnotationPoints } from '@renderer/hooks/useLabeler'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation, IPoint, OmitV2 } from '@shared/types'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StoreApi, UseBoundStore } from 'zustand'
import { ContextMenuProvider, useContextMenu } from 'mantine-contextmenu'
import { MdDeleteOutline } from 'react-icons/md'

type LabelerDebugCommands = {
  setHitTestDebugOverlay: (enabled: boolean) => void
  getHitTestDebugOverlay: () => boolean
}

const ANNOTATION_ALPHA = 0.2
const CREATION_ANNOTATION_ALPHA = 0.45
const CONTROL_POINT_CIRCLE_RADIUS = 7
const HIT_TEST_LINE_WIDTH = 8
const HIT_TEST_OVERLAY_ALPHA = 0.5
const MAX_BITMAP_COORDINATE = 9_000_000

const CanvasContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
`
const Canvas = styled.canvas`
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0px;
  top: 0px;
`
const CrosshairCanvas = styled.canvas`
  position: absolute;
  width: 100%;
  height: 100%;
  left: 0px;
  top: 0px;
  mix-blend-mode: difference;
  pointer-events: none;
`

const transformPoints = (
  points: IPoint[],
  xOffset: number,
  yOffset: number,
  xScale: number,
  yScale: number
) => {
  return points.map<IPoint>((p) => {
    return {
      id: p.id,
      x: xOffset + p.x * xScale,
      y: yOffset + p.y * yScale
    }
  })
}

const drawLine = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  begin: OmitV2<IPoint, 'id'>,
  end: OmitV2<IPoint, 'id'>,
  color: string,
  lineWidth = 1,
  alpha = 1
) => {
  const restoreAlpha = ctx.globalAlpha
  if (alpha < 1) {
    ctx.globalAlpha = alpha
  }
  ctx.beginPath()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = color

  ctx.moveTo(begin.x, begin.y)

  ctx.lineTo(end.x, end.y)
  ctx.stroke()

  if (ctx.globalAlpha !== restoreAlpha) {
    ctx.globalAlpha = restoreAlpha
  }
}

const drawPolygon = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  data: OmitV2<IPoint, 'id'>[],
  color: string,
  fill: boolean,
  lineWidth = 1,
  alpha = 1
) => {
  const restoreAlpha = ctx.globalAlpha
  if (alpha < 1) {
    ctx.globalAlpha = alpha
  }
  ctx.beginPath()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (fill) ctx.fillStyle = color

  ctx.lineWidth = lineWidth

  ctx.strokeStyle = color

  const startPoint = data[0]

  ctx.moveTo(startPoint.x, startPoint.y)

  for (let i = 0; i < data.length; i++) {
    const nextPoint = data[(i + 1) % data.length]

    ctx.lineTo(nextPoint.x, nextPoint.y)
  }

  //if (closed) ctx.closePath();

  if (fill) {
    ctx.fill()
  } else {
    ctx.stroke()
  }
  if (ctx.globalAlpha !== restoreAlpha) {
    ctx.globalAlpha = restoreAlpha
  }
}

const drawCircle = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: OmitV2<IPoint, 'id'>,
  color: string,
  radius: number = 10,
  borderSize = 2,
  borderColor: string = 'black'
) => {
  ctx.beginPath()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (borderSize > 0) {
    ctx.strokeStyle = borderColor
    ctx.lineWidth = borderSize + 1
    ctx.arc(point.x, point.y, radius - 1, 0, 2 * Math.PI)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(point.x, point.y, radius - borderSize, 0, 2 * Math.PI)
  ctx.fill()
}

const drawControlCircle = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  point: OmitV2<IPoint, 'id'>,
  radius: number = 10,
  borderSize = 2
) => drawCircle(ctx, point, 'white', radius, borderSize, 'black')

const getBoxPoints = (points: OmitV2<IPoint, 'id'>[]) => [
  points[0],
  { x: points[1].x, y: points[0].y },
  points[1],
  { x: points[0].x, y: points[1].y }
]

const drawSelectedHitHandles = (
  selectedAnnotation: IAnnotation,
  hitTestCtx: OffscreenCanvasRenderingContext2D,
  state: LabelerStore,
  points: IPoint[]
) => {
  if (state.selectedAnnotation === null) {
    return
  }

  if (selectedAnnotation.type === AnnotationType.Box) {
    drawCircle(
      hitTestCtx,
      points[0],
      state.selectedAnnotationControlHitIds.getByValue(points[0].id)!,
      CONTROL_POINT_CIRCLE_RADIUS,
      0
    )
    drawCircle(
      hitTestCtx,
      points[1],
      state.selectedAnnotationControlHitIds.getByValue(points[1].id)!,
      CONTROL_POINT_CIRCLE_RADIUS,
      0
    )
    return
  }

  for (let i = 0; i < points.length; i++) {
    const current = points[i]
    const next = i === points.length - 1 ? points[0] : points[i + 1]
    drawLine(
      hitTestCtx,
      current,
      next,
      state.selectedAnnotationLineHitIds.getByValue(current.id)!,
      HIT_TEST_LINE_WIDTH
    )
  }

  for (const point of points) {
    drawCircle(
      hitTestCtx,
      point,
      state.selectedAnnotationControlHitIds.getByValue(point.id)!,
      CONTROL_POINT_CIRCLE_RADIUS,
      0
    )
  }
}

const drawCreationPreview = (
  annotationCtx: CanvasRenderingContext2D,
  state: LabelerStore,
  xScale: number,
  yScale: number
) => {
  if (state.annotationBeingCreated === null) {
    return
  }

  const annotation = state.annotationBeingCreated
  const points = transformPoints(
    annotation.points,
    state.imageRect.x,
    state.imageRect.y,
    xScale,
    yScale
  )

  if (points.length === 1) {
    return
  }

  if (annotation.type === AnnotationType.Box) {
    const minX = Math.min(points[0].x, points[1].x)
    const minY = Math.min(points[0].y, points[1].y)
    const maxX = Math.max(points[0].x, points[1].x)
    const maxY = Math.max(points[0].y, points[1].y)

    const p0 = { x: minX, y: minY }
    const p1 = { x: maxX, y: maxY }
    const actualPoints = [p0, { x: maxX, y: minY }, p1, { x: minX, y: maxY }]
    drawPolygon(
      annotationCtx,
      actualPoints,
      state.labelsMap[annotation.labelId].color,
      true,
      undefined,
      CREATION_ANNOTATION_ALPHA
    )
    return
  }

  if (points.length < 3) {
    drawLine(
      annotationCtx,
      points[0],
      points[1],
      state.labelsMap[annotation.labelId].color,
      undefined,
      CREATION_ANNOTATION_ALPHA
    )
  } else {
    drawPolygon(
      annotationCtx,
      points,
      state.labelsMap[annotation.labelId].color,
      true,
      undefined,
      CREATION_ANNOTATION_ALPHA
    )
  }
}

const drawCrosshair = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  ctx.save()
  ctx.globalCompositeOperation = 'difference'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(width, y)
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()
  ctx.restore()
}

function* allAnnotationsGenerator(
  annotations: IAnnotation[],
  selectedAnnotation: IAnnotation | null
) {
  for (const x of annotations) {
    yield x
  }

  if (selectedAnnotation !== null) {
    yield selectedAnnotation
  }
}

export type LabelerProps = {
  store: UseBoundStore<StoreApi<LabelerStore>>
  className?: string
}

export const Labeler = ({ store, className }: LabelerProps) => {
  const contextMenuOpenedAtRef = useRef<[x: number, y: number]>([0, 0])
  const { showContextMenu } = useContextMenu()
  const selectedAnnotationLabelId = store((s) => s.selectedAnnotation?.resolve().labelId ?? '')

  const selectedAnnotationContextMenuHandler = useMemo(() => {
    const labels = store.getState().labelsMap
    const values = Object.keys(labels).sort()
    values.splice(values.indexOf(selectedAnnotationLabelId), 1)
    // eslint-disable-next-line react-hooks/refs
    return showContextMenu([
      ...(values.length > 0
        ? [
            {
              key: 'change-label',
              title: 'Label',
              items: values.map((c) => ({
                key: `set-label-${c}`,
                title: labels[c].name,
                color: labels[c].color,
                onClick: () => {
                  store.getState().setSelectedAnnotationLabelId(c)
                }
              }))
            }
          ]
        : []),
      {
        key: 'delete',
        icon: <MdDeleteOutline size={16} />,
        title: 'Delete',
        onClick: () => {
          const state = store.getState()
          const [mouseX, mouseY] = contextMenuOpenedAtRef.current
          const result = state.hittest(mouseX, mouseY)

          if (result !== null && result?.annotationId !== null) {
            store.getState().deleteAnnotation(result.annotationId)
          }
        }
      }
    ])
  }, [selectedAnnotationLabelId, showContextMenu, store])

  const containerRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const crosshairCanvasRef = useRef<HTMLCanvasElement>(null)

  const drawCanvases = useCallback(() => {
    const imageCanvas = imageCanvasRef.current
    const annotationCanvas = annotationCanvasRef.current
    const crosshairCanvas = crosshairCanvasRef.current

    if (imageCanvas === null || annotationCanvas === null || crosshairCanvas === null) return

    const { width, height } = imageCanvas.getBoundingClientRect()
    let state = store.getState()

    if (state.canvasSize[0] !== width || state.canvasSize[1] !== height) {
      state.onCanvasResize(width, height)
      state = store.getState()
    }
    const sizeDirty = state.sizeDirty
    const imageDirty = state.imageDirty
    const annotationDirty = state.annotationDirty || state.hitTestDirty
    const hitTestDirty = state.hitTestDirty

    state.preDraw()

    if (sizeDirty) {
      imageCanvas.width =
        state.hitTestCanvas.width =
        annotationCanvas.width =
        crosshairCanvas.width =
          width
      imageCanvas.height =
        state.hitTestCanvas.height =
        annotationCanvas.height =
        crosshairCanvas.height =
          height
    }

    let imageCtx: CanvasRenderingContext2D | null = null
    let annotationCtx: CanvasRenderingContext2D | null = null
    let hitTestCtx: OffscreenCanvasRenderingContext2D | null = null

    if (imageDirty) {
      imageCtx = imageCanvas.getContext('2d')
    }
    if (annotationDirty) {
      annotationCtx = annotationCanvas.getContext('2d')
    }
    if (hitTestDirty) {
      hitTestCtx = state.hitTestCanvas.getContext('2d', { willReadFrequently: true })
    }

    if (state.bitmap !== null) {
      if (imageCtx !== null) {
        imageCtx.clearRect(0, 0, width, height)
        imageCtx.drawImage(
          state.bitmap,
          state.imageRect.x,
          state.imageRect.y,
          state.imageRect.width,
          state.imageRect.height
        )
      }
      const xScale = state.imageRect.width / state.bitmap.width
      const yScale = state.imageRect.height / state.bitmap.height

      let selectedAnnotation = state.selectedAnnotation?.resolve() ?? null
      const annotations = Object.values(state.sample?.resolve().annotations?.resolve() ?? {})
        .map((c) => c.resolve())
        .filter((c) => c.id !== selectedAnnotation?.id)

      if (selectedAnnotation !== null && state.pointIdsBeingMoved !== null) {
        selectedAnnotation = structuredClone(selectedAnnotation)
        const pointsBeingMoved = new Set(state.pointIdsBeingMoved ?? [])
        const [dx, dy] = state.moveCurrent
        for (const point of selectedAnnotation.points) {
          if (pointsBeingMoved.has(point.id)) {
            point.x += dx
            point.y += dy
          }
        }

        selectedAnnotation = normalizeAnnotationPoints(selectedAnnotation)
      }

      if (hitTestCtx !== null) {
        const offScreenCanvas = hitTestCtx.canvas
        hitTestCtx.clearRect(0, 0, offScreenCanvas.width, offScreenCanvas.height)

        if (state.mode === LabelerMode.Select) {
          for (const annotation of allAnnotationsGenerator(annotations, selectedAnnotation)) {
            const points = transformPoints(
              annotation.points,
              state.imageRect.x,
              state.imageRect.y,
              xScale,
              yScale
            )

            switch (annotation.type) {
              case AnnotationType.Box:
                {
                  drawPolygon(
                    hitTestCtx,
                    getBoxPoints(points),
                    state.hitIdToAnnotationId.getByValue(annotation.id)!,
                    true
                  )
                }
                break

              case AnnotationType.Mask:
                {
                  drawPolygon(
                    hitTestCtx,
                    points,
                    state.hitIdToAnnotationId.getByValue(annotation.id)!,
                    true
                  )
                }
                break
            }
          }

          if (selectedAnnotation !== null) {
            const points = transformPoints(
              selectedAnnotation.points,
              state.imageRect.x,
              state.imageRect.y,
              xScale,
              yScale
            )

            switch (selectedAnnotation.type) {
              case AnnotationType.Box:
                drawSelectedHitHandles(selectedAnnotation, hitTestCtx, state, points)
                break

              case AnnotationType.Mask:
                drawSelectedHitHandles(selectedAnnotation, hitTestCtx, state, points)
                break
            }
          }
        }
      }

      if (annotationCtx !== null) {
        annotationCtx.clearRect(0, 0, width, height)

        for (const annotation of allAnnotationsGenerator(annotations, selectedAnnotation)) {
          const points = transformPoints(
            annotation.points,
            state.imageRect.x,
            state.imageRect.y,
            xScale,
            yScale
          )
          //const compositeOperation = annotationCtx.globalCompositeOperation // Heavy on performance
          switch (annotation.type) {
            case AnnotationType.Box:
              {
                const actualPoints = getBoxPoints(points)

                drawPolygon(
                  annotationCtx,
                  actualPoints,
                  state.labelsMap[annotation.labelId].color,
                  true,
                  undefined,
                  ANNOTATION_ALPHA
                )

                //annotationCtx.globalCompositeOperation = 'difference'
                drawPolygon(
                  annotationCtx,
                  actualPoints,
                  state.labelsMap[annotation.labelId].color,
                  false,
                  2
                )
                //annotationCtx.globalCompositeOperation = compositeOperation
              }
              break

            case AnnotationType.Mask:
              {
                drawPolygon(
                  annotationCtx,
                  points,
                  state.labelsMap[annotation.labelId].color,
                  true,
                  undefined,
                  ANNOTATION_ALPHA
                )

                //annotationCtx.globalCompositeOperation = 'difference'
                drawPolygon(
                  annotationCtx,
                  points,
                  state.labelsMap[annotation.labelId].color,
                  false,
                  2
                )
                //annotationCtx.globalCompositeOperation = compositeOperation
              }
              break
          }
        }

        if (selectedAnnotation !== null) {
          const points = transformPoints(
            selectedAnnotation.points,
            state.imageRect.x,
            state.imageRect.y,
            xScale,
            yScale
          )

          switch (selectedAnnotation.type) {
            case AnnotationType.Box:
              {
                drawControlCircle(annotationCtx, points[0], CONTROL_POINT_CIRCLE_RADIUS)

                drawControlCircle(annotationCtx, points[1], CONTROL_POINT_CIRCLE_RADIUS)
              }
              break

            case AnnotationType.Mask:
              {
                for (const point of points) {
                  drawControlCircle(annotationCtx, point, CONTROL_POINT_CIRCLE_RADIUS)
                }
              }
              break
          }
        }

        drawCreationPreview(annotationCtx, state, xScale, yScale)

        if (state.showHitTestDebugOverlay) {
          annotationCtx.globalAlpha = HIT_TEST_OVERLAY_ALPHA
          annotationCtx.drawImage(state.hitTestCanvas, 0, 0)
          annotationCtx.globalAlpha = 1
        }
      }
    }

    const crosshairCtx = crosshairCanvas.getContext('2d')
    if (crosshairCtx !== null) {
      crosshairCtx.clearRect(0, 0, width, height)
      if (state.mode === LabelerMode.CreateBox || state.mode === LabelerMode.CreateMask) {
        drawCrosshair(crosshairCtx, state.mousePos[0], state.mousePos[1], width, height)
      }
    }
  }, [store])

  // Used to debug hittests
  useEffect(() => {
    const debugCommands: LabelerDebugCommands = {
      setHitTestDebugOverlay: (enabled: boolean) => {
        store.getState().setShowHitTestDebugOverlay(Boolean(enabled))
      },
      getHitTestDebugOverlay: () => store.getState().showHitTestDebugOverlay
    }

    ;(window as Window & { labelerDebug?: LabelerDebugCommands }).labelerDebug = debugCommands

    return () => {
      const runtime = window as Window & { labelerDebug?: LabelerDebugCommands }
      if (runtime.labelerDebug === debugCommands) {
        delete runtime.labelerDebug
      }
    }
  }, [store])

  // Animation loop, maybe do somekind of request on dirty system in the future
  useEffect(() => {
    let frameId: number | null
    const callback = () => {
      drawCanvases()
      frameId = requestAnimationFrame(callback)
    }
    frameId = requestAnimationFrame(callback)
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [drawCanvases])

  // Track mouse move during creation
  useEffect(() => {
    const documentElement = document.documentElement
    const container = containerRef.current
    if (documentElement === null || container === null) return

    const { onMouseMove } = store.getState()
    const callback: (ev: MouseEvent) => void = (e) => {
      const rect = container.getBoundingClientRect()
      onMouseMove(e.clientX - rect.x, e.clientY - rect.y)
    }

    documentElement.addEventListener('mousemove', callback)
    return () => documentElement.removeEventListener('mousemove', callback)
  }, [store])

  // Track clicks and handle pans and zoom
  useEffect(() => {
    const element = containerRef.current
    const documentElement = document.documentElement
    if (element === null || documentElement === null) return

    const toCanvasSpace = (event: Pick<MouseEvent, 'clientX' | 'clientY'>) => {
      const rect = element.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    }

    const watchMouseMove = (
      downEvent: MouseEvent,
      callback: (x: number, y: number) => void,
      onRelease?: (ev: MouseEvent) => void
    ) => {
      store.setState({ isDragging: true })

      const moveCallback = (e: MouseEvent) => {
        const movePos = toCanvasSpace(e)
        callback(movePos.x, movePos.y)
      }

      const upCallback = (e: MouseEvent) => {
        if (e.button !== downEvent.button) {
          return
        }
        documentElement.removeEventListener('mousemove', moveCallback)
        documentElement.removeEventListener('mouseup', upCallback)
        store.setState({ isDragging: false })
        onRelease?.(e)
      }

      documentElement.addEventListener('mouseup', upCallback)
      documentElement.addEventListener('mousemove', moveCallback)
    }

    const mouseDownListener = (mouseDownEvent: MouseEvent) => {
      if ([0, 2].includes(mouseDownEvent.button)) {
        mouseDownEvent.preventDefault()
        {
          const active = document.activeElement as HTMLElement | null
          if (active && active !== document.body) {
            active.blur()
          }

          ;(mouseDownEvent.target as HTMLDivElement).focus()
        }
        const mouseDownPos = { x: mouseDownEvent.offsetX, y: mouseDownEvent.offsetY }

        const forcedPan = mouseDownEvent.button === 0 && mouseDownEvent.ctrlKey
        // Do hit test here
        if (!forcedPan) {
          let state = store.getState()
          const result = state.hittest(Math.floor(mouseDownPos.x), Math.floor(mouseDownPos.y))

          if (result !== null) {
            if (mouseDownEvent.button === 0) {
              if (state.mode === LabelerMode.Select) {
                // First we figure out selection then do other ops
                if (
                  state.selectedAnnotation !== null &&
                  state.selectedAnnotation.resolve().id !== result.annotationId
                ) {
                  state.selectAnnotation(null)
                  state = store.getState()
                }

                if (state.selectedAnnotation === null && result.annotationId !== undefined) {
                  const annotationId = result.annotationId
                  state.selectAnnotation(annotationId)
                  state = store.getState()
                }

                if (state.selectedAnnotation !== null && result.annotationId !== null) {
                  if (state.selectedAnnotation.resolve().id === result.annotationId) {
                    // Move annotation control point
                    if (result.controlPointId !== null) {
                      const pointId = result.controlPointId
                      const annotationId = state.selectedAnnotation.resolve().id
                      //const initialPoints = structuredClone(state.selectedAnnotation.resolve().points)
                      watchMouseMove(
                        mouseDownEvent,
                        (x, y) => {
                          state.moveAnnotationPoint(pointId, x, y)
                        },
                        () => {
                          state.commitAnnotationMove(annotationId)
                        }
                      )

                      return
                    }

                    // Move annotation
                    {
                      const annotationId = state.selectedAnnotation.resolve().id
                      const initialPoints = structuredClone(
                        state.selectedAnnotation.resolve().points
                      )

                      const minPoints = initialPoints.reduce(
                        (t, c) => {
                          return { x: Math.min(c.x, t.x), y: Math.min(c.y, t.y) }
                        },
                        { x: initialPoints[0].x, y: initialPoints[0].y }
                      )

                      const maxPoints = initialPoints.reduce(
                        (t, c) => {
                          return { x: Math.max(c.x, t.x), y: Math.max(c.y, t.y) }
                        },
                        { x: initialPoints[0].x, y: initialPoints[0].y }
                      )

                      const [startX, startY] = state.canvasToBitmapSpace(
                        mouseDownPos.x,
                        mouseDownPos.y
                      )

                      const [endX, endY] = state.canvasToBitmapSpace(
                        MAX_BITMAP_COORDINATE,
                        MAX_BITMAP_COORDINATE
                      )

                      const allowedDiffTowardsMinimum = [-minPoints.x, -minPoints.y]
                      const allowedDiffTowardMaximum = [endX - maxPoints.x, endY - maxPoints.y]
                      watchMouseMove(
                        mouseDownEvent,
                        (x, y) => {
                          const [currentX, currentY] = state.canvasToBitmapSpace(x, y)

                          const dx = clamp(
                            currentX - startX,
                            allowedDiffTowardsMinimum[0],
                            allowedDiffTowardMaximum[0]
                          )
                          const dy = clamp(
                            currentY - startY,
                            allowedDiffTowardsMinimum[1],
                            allowedDiffTowardMaximum[1]
                          )

                          state.moveSelectedAnnotationBy(dx, dy)
                        },
                        () => {
                          state.commitAnnotationMove(annotationId)
                        }
                      )
                    }
                    return
                  }
                }
              } else if (state.mode === LabelerMode.CreateBox) {
                state.onConfirmPoint(mouseDownPos.x, mouseDownPos.y)

                watchMouseMove(
                  mouseDownEvent,
                  (x, y) => {
                    store.getState().onMouseMove(x, y)
                  },
                  () => {
                    const releaseState = store.getState()
                    if (releaseState.annotationBeingCreated?.points.length === 2) {
                      releaseState.onConfirmAnnotationCreation()
                    }
                  }
                )
                return
              } else if (state.mode === LabelerMode.CreateMask) {
                state.onConfirmPoint(mouseDownPos.x, mouseDownPos.y)
                return
              }
            } else if (mouseDownEvent.button === 2) {
              if (state.mode === LabelerMode.CreateBox) {
                if (state.annotationBeingCreated?.points.length === 2) {
                  state.onConfirmAnnotationCreation()
                  return
                }
              } else if (state.mode === LabelerMode.CreateMask) {
                if ((state.annotationBeingCreated?.points.length ?? 0) >= 4) {
                  state.onConfirmAnnotationCreation(true)
                  return
                }
              }
            }
          } else {
            state.selectAnnotation(null)
          }
        }

        // If no hit default to pan
        if (forcedPan || mouseDownEvent.button === 0) {
          const startX = mouseDownPos.x
          const startY = mouseDownPos.y
          const state = store.getState()
          const offsetStart = { x: state.imageRect.x, y: state.imageRect.y }

          watchMouseMove(mouseDownEvent, (x, y) => {
            const dx = x - startX
            const dy = y - startY

            const current = store.getState()
            store.setState({
              imageRect: {
                ...current.imageRect,
                x: offsetStart.x + dx,
                y: offsetStart.y + dy
              }
            })
            store.getState().markAllDirty()
          })
        }
      }
    }
    const wheelListener = (ev: WheelEvent) => {
      store.getState().zoom(ev.offsetX, ev.offsetY, ev.deltaY * -0.001)
    }

    element.addEventListener('mousedown', mouseDownListener)
    element.addEventListener('wheel', wheelListener)
    return () => {
      element.removeEventListener('mousedown', mouseDownListener)
      element.removeEventListener('wheel', wheelListener)
    }
  }, [store])

  return (
    <ContextMenuProvider submenuDelay={10}>
      <CanvasContainer
        ref={containerRef}
        className={className}
        onContextMenu={(e) => {
          const state = store.getState()
          const [mouseX, mouseY] = state.mousePos
          const result = state.hittest(mouseX, mouseY)
          contextMenuOpenedAtRef.current = [mouseX, mouseY]
          if (
            result !== null &&
            result.annotationId !== null &&
            result.annotationId === state.selectedAnnotation?.resolve().id
          ) {
            if (
              result.controlPointId === result.lineControlPointId &&
              result.controlPointId === null
            ) {
              selectedAnnotationContextMenuHandler(e)
            }
          }
        }}
        tabIndex={0}
      >
        <Canvas ref={imageCanvasRef} />
        <Canvas ref={annotationCanvasRef} />
        <CrosshairCanvas ref={crosshairCanvasRef} />
      </CanvasContainer>
    </ContextMenuProvider>
  )
}

Labeler.displayName = 'Labeler'
