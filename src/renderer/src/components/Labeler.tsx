import { styled } from '@linaria/react'
import {
  axisMaskedMoveDelta,
  BOX_CORNER_HANDLE_BOTTOM_LEFT,
  BOX_CORNER_HANDLE_TOP_RIGHT,
  BOX_EDGE_BOTTOM,
  BOX_EDGE_LEFT,
  BOX_EDGE_RIGHT,
  BOX_EDGE_TOP,
  LabelerStore,
  normalizeAnnotationPoints
} from '@renderer/hooks/useLabeler'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation, IPoint, OmitV2 } from '@shared/types'
import { PointerEventHandler, RefObject, useCallback, useEffect, useRef } from 'react'
import { StoreApi, UseBoundStore } from 'zustand'
import { ContextMenuItemOptions, useContextMenu } from 'mantine-contextmenu'
import { MdContentCopy, MdDeleteOutline } from 'react-icons/md'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { PiPolygonLight } from 'react-icons/pi'
import { tools } from './labeler/tools'
import { PointerResult, type LabelerToolContext } from './labeler/types'

const SKIP_NEXT_CONTEXT_MENU_ATTRIBUTE = 'data-skip-next-context'
type LabelerCommands = {
  enableHitTestDebug: () => void
  disableHitTestDebug: () => void
}

const ANNOTATION_ALPHA = 0.2
const CREATION_ANNOTATION_ALPHA = 0.45
const CONTROL_POINT_CIRCLE_RADIUS = 7
const HIT_TEST_LINE_WIDTH = 8
const HIT_TEST_OVERLAY_ALPHA = 0.5

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
    // Drawn before the corner circles below so a corner's hit area wins over an overlapping edge.
    const boxCorners = getBoxPoints(points)
    const edgeSentinels = [BOX_EDGE_TOP, BOX_EDGE_RIGHT, BOX_EDGE_BOTTOM, BOX_EDGE_LEFT]
    for (let i = 0; i < boxCorners.length; i++) {
      const hitId = state.selectedAnnotationLineHitIds.getByValue(edgeSentinels[i])
      if (hitId === undefined) continue
      drawLine(
        hitTestCtx,
        boxCorners[i],
        boxCorners[(i + 1) % boxCorners.length],
        hitId,
        HIT_TEST_LINE_WIDTH
      )
    }

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

    // The 2 derived corners - visual/hit-test only, no real IPoint behind them.
    const topRightHitId = state.selectedAnnotationControlHitIds.getByValue(
      BOX_CORNER_HANDLE_TOP_RIGHT
    )
    const bottomLeftHitId = state.selectedAnnotationControlHitIds.getByValue(
      BOX_CORNER_HANDLE_BOTTOM_LEFT
    )
    if (topRightHitId !== undefined) {
      drawCircle(
        hitTestCtx,
        { x: points[1].x, y: points[0].y },
        topRightHitId,
        CONTROL_POINT_CIRCLE_RADIUS,
        0
      )
    }
    if (bottomLeftHitId !== undefined) {
      drawCircle(
        hitTestCtx,
        { x: points[0].x, y: points[1].y },
        bottomLeftHitId,
        CONTROL_POINT_CIRCLE_RADIUS,
        0
      )
    }
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

const HOVER_DIM_ALPHA = 0.55
const HOVER_OUTLINE_WIDTH = 3

/** Dims the whole canvas - driven by "is the mouse over the AnnotationsDrawer", not a single row, to avoid flicker crossing row gaps. */
const dimCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.fillStyle = `rgba(0, 0, 0, ${HOVER_DIM_ALPHA})`
  ctx.fillRect(0, 0, width, height)
}

/** Cuts a hole matching a shape out of whatever's already drawn (dimCanvas's overlay), via a destination-out composite. */
const cutoutShape = (ctx: CanvasRenderingContext2D, shapePoints: OmitV2<IPoint, 'id'>[]) => {
  if (shapePoints.length < 2) return

  const restoreComposite = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = 'destination-out'
  drawPolygon(ctx, shapePoints, 'rgba(0, 0, 0, 1)', true)
  ctx.globalCompositeOperation = restoreComposite
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

const useLabelerContextMenu = (store: UseBoundStore<StoreApi<LabelerStore>>) => {
  const { showContextMenu: originalShowContextMenu } = useContextMenu()
  const onContextMenu = useCallback<PointerEventHandler<HTMLDivElement>>(
    (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.currentTarget.hasAttribute(SKIP_NEXT_CONTEXT_MENU_ATTRIBUTE)) {
        e.currentTarget.toggleAttribute(SKIP_NEXT_CONTEXT_MENU_ATTRIBUTE, false)
        return
      }
      const state = store.getState()
      const [mouseX, mouseY] = state.mousePos
      const result = state.hittest(mouseX, mouseY)

      if (
        result !== null &&
        result.controlPointId === result.lineControlPointId &&
        result.controlPointId === null
      ) {
        const menuOptions: ContextMenuItemOptions[] = []
        const resolvedTargetAnnotation =
          store
            .getState()
            .sample?.resolve()
            .annotations.resolve()
            [result.annotationId ?? ''].resolve() ?? null
        if (resolvedTargetAnnotation === null) {
          return
        }
        {
          const labels = store.getState().labelsMap
          const values = Object.keys(labels).sort()
          values.splice(values.indexOf(resolvedTargetAnnotation.labelId), 1)
          if (values.length > 0) {
            menuOptions.push({
              key: 'change-label',
              title: 'Label',
              items: values.map((c) => ({
                key: `set-label-${c}`,
                title: labels[c].name,
                color: labels[c].color,
                onClick: () => store.getState().setAnnotationLabelId(resolvedTargetAnnotation.id, c)
              }))
            })
          }
        }

        menuOptions.push({
          key: 'duplicate',
          icon: <MdContentCopy size={16} />,
          title: 'Duplicate',
          onClick: () => store.getState().duplicateAnnotation(resolvedTargetAnnotation.id)
        })

        menuOptions.push({
          key: 'convert-type',
          icon:
            resolvedTargetAnnotation.type === AnnotationType.Box ? (
              <PiPolygonLight size={16} />
            ) : (
              <BsBoundingBoxCircles size={16} />
            ),
          title:
            resolvedTargetAnnotation.type === AnnotationType.Box
              ? 'Convert to Polygon'
              : 'Convert to Box',
          onClick: () => store.getState().convertAnnotationType(resolvedTargetAnnotation.id)
        })

        menuOptions.push({
          key: 'delete',
          icon: <MdDeleteOutline size={16} />,
          title: 'Delete',
          onClick: () => store.getState().deleteAnnotation(resolvedTargetAnnotation.id)
        })
        const builtContextMenu = originalShowContextMenu(menuOptions)
        builtContextMenu(e)
      }
    },
    [originalShowContextMenu, store]
  )
  return onContextMenu
}

const usePointerMove = (
  store: UseBoundStore<StoreApi<LabelerStore>>,
  container: RefObject<HTMLDivElement | null>
) => {
  // Track mouse move during creation
  useEffect(() => {
    const documentElement = document.documentElement
    const containerElement = container.current
    if (documentElement === null || containerElement === null) return

    const { onMouseMove } = store.getState()
    const callback: (ev: PointerEvent) => void = (e) => {
      const rect = containerElement.getBoundingClientRect()
      onMouseMove(e.clientX - rect.x, e.clientY - rect.y)
    }

    documentElement.addEventListener('pointermove', callback)
    return () => documentElement.removeEventListener('pointermove', callback)
  }, [container, store])
}

const usePointerInteractions = (
  store: UseBoundStore<StoreApi<LabelerStore>>,
  container: RefObject<HTMLDivElement | null>
) => {
  // Track clicks and handle pans and zoom
  useEffect(() => {
    const element = container.current
    const documentElement = document.documentElement
    if (element === null || documentElement === null) return

    const toCanvasSpace = (event: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
      const rect = element.getBoundingClientRect()
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      }
    }

    const watchPointerMove = (
      downEvent: PointerEvent,
      onMove: (x: number, y: number) => void,
      onRelease?: () => void
    ) => {
      store.setState({ isDragging: true })

      const moveCallback = (e: PointerEvent) => {
        const movePos = toCanvasSpace(e)
        onMove(movePos.x, movePos.y)
      }

      const upCallback = (e: PointerEvent) => {
        if (e.button !== downEvent.button) {
          return
        }
        documentElement.removeEventListener('pointermove', moveCallback)
        documentElement.removeEventListener('pointerup', upCallback)
        store.setState({ isDragging: false })
        onRelease?.()
      }

      documentElement.addEventListener('pointerup', upCallback)
      documentElement.addEventListener('pointermove', moveCallback)
    }

    const startPan = (pointerDownEvent: PointerEvent, mouseDownPos: { x: number; y: number }) => {
      const startX = mouseDownPos.x
      const startY = mouseDownPos.y
      const state = store.getState()
      const offsetStart = { x: state.imageRect.x, y: state.imageRect.y }

      watchPointerMove(pointerDownEvent, (x, y) => {
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

    const pointerDownListener = (pointerDownEvent: PointerEvent) => {
      if (![0, 2].includes(pointerDownEvent.button)) return

      const skipNextContextMenu = () =>
        (pointerDownEvent.currentTarget as HTMLDivElement).toggleAttribute(
          SKIP_NEXT_CONTEXT_MENU_ATTRIBUTE,
          true
        )
      const handled = () => {
        pointerDownEvent.preventDefault()
        pointerDownEvent.stopImmediatePropagation()
      }
      {
        const active = document.activeElement as HTMLElement | null
        if (active && active !== document.body) {
          active.blur()
        }

        ;(pointerDownEvent.target as HTMLDivElement).focus()
      }
      const mouseDownPos = { x: pointerDownEvent.offsetX, y: pointerDownEvent.offsetY }

      const forcedPan = pointerDownEvent.button === 0 && pointerDownEvent.ctrlKey

      if (!forcedPan) {
        const state = store.getState()
        const hit = state.hittest(Math.floor(mouseDownPos.x), Math.floor(mouseDownPos.y))
        const tool = tools[state.mode]
        const ctx: LabelerToolContext = {
          store,
          startDrag: (onMove, onRelease) => watchPointerMove(pointerDownEvent, onMove, onRelease)
        }

        if (pointerDownEvent.button === 2) {
          const result = tool.onRightPointerDown?.(ctx, mouseDownPos, hit) ?? PointerResult.Default
          if (result === PointerResult.Consumed) {
            skipNextContextMenu()
            handled()
          }
          return
        }

        // button === 0
        const result = tool.onPointerDown?.(ctx, mouseDownPos, hit) ?? PointerResult.Default
        handled()
        if (result === PointerResult.Consumed) {
          return
        }
        // Default: fall through to the pan below.
      }

      // Pan fallback: either forced (ctrl+left-click) or an unconsumed left-click.
      startPan(pointerDownEvent, mouseDownPos)
    }
    const wheelListener = (ev: WheelEvent) => {
      store.getState().zoom(ev.offsetX, ev.offsetY, ev.deltaY * -0.001)
    }

    element.addEventListener('pointerdown', pointerDownListener)
    element.addEventListener('wheel', wheelListener)
    return () => {
      element.removeEventListener('pointerdown', pointerDownListener)
      element.removeEventListener('wheel', wheelListener)
    }
  }, [container, store])
}

const usePointer = (
  store: UseBoundStore<StoreApi<LabelerStore>>,
  container: RefObject<HTMLDivElement | null>
) => {
  usePointerMove(store, container)
  usePointerInteractions(store, container)
}

const useCanvasDraw = (
  store: UseBoundStore<StoreApi<LabelerStore>>,
  imageCanvas: RefObject<HTMLCanvasElement | null>,
  annotationCanvas: RefObject<HTMLCanvasElement | null>,
  crosshairCanvas: RefObject<HTMLCanvasElement | null>
) => {
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- refs/store are stable; deps track identity, not .current
  const drawCanvases = useCallback(() => {
    const imageCanvasElement = imageCanvas.current
    const annotationCanvasElement = annotationCanvas.current
    const crosshairCanvasElement = crosshairCanvas.current

    if (
      imageCanvasElement === null ||
      annotationCanvasElement === null ||
      crosshairCanvasElement === null
    )
      return

    const { width, height } = imageCanvasElement.getBoundingClientRect()
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
      // react-hooks/immutability should not apply to element refs
      // eslint-disable-next-line react-hooks/immutability
      imageCanvasElement.width =
        state.hitTestCanvas.width =
        // eslint-disable-next-line react-hooks/immutability
        annotationCanvasElement.width =
        // eslint-disable-next-line react-hooks/immutability
        crosshairCanvasElement.width =
          width
      imageCanvasElement.height =
        state.hitTestCanvas.height =
        annotationCanvasElement.height =
        crosshairCanvasElement.height =
          height
    }

    let imageCtx: CanvasRenderingContext2D | null = null
    let annotationCtx: CanvasRenderingContext2D | null = null
    let hitTestCtx: OffscreenCanvasRenderingContext2D | null = null

    if (imageDirty) {
      imageCtx = imageCanvasElement.getContext('2d')
    }
    if (annotationDirty) {
      annotationCtx = annotationCanvasElement.getContext('2d')
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
        for (const point of selectedAnnotation.points) {
          const [dx, dy] = axisMaskedMoveDelta(
            point.id,
            state.pointIdsBeingMoved,
            state.pointIdsBeingMovedAxis,
            state.moveCurrent
          )
          point.x += dx
          point.y += dy
        }

        selectedAnnotation = normalizeAnnotationPoints(selectedAnnotation)
      }

      if (hitTestCtx !== null) {
        const offScreenCanvas = hitTestCtx.canvas
        hitTestCtx.clearRect(0, 0, offScreenCanvas.width, offScreenCanvas.height)

        if (state.mode === LabelerMode.Select) {
          for (const annotation of allAnnotationsGenerator(annotations, selectedAnnotation)) {
            const hitId = state.hitIdToAnnotationId.getByValue(annotation.id)
            if (hitId !== undefined) {
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
                    drawPolygon(hitTestCtx, getBoxPoints(points), hitId, true)
                  }
                  break

                case AnnotationType.Polygon:
                  {
                    drawPolygon(hitTestCtx, points, hitId, true)
                  }
                  break
              }
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

              case AnnotationType.Polygon:
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

                drawPolygon(
                  annotationCtx,
                  actualPoints,
                  state.labelsMap[annotation.labelId].color,
                  false,
                  2
                )
              }
              break

            case AnnotationType.Polygon:
              {
                drawPolygon(
                  annotationCtx,
                  points,
                  state.labelsMap[annotation.labelId].color,
                  true,
                  undefined,
                  ANNOTATION_ALPHA
                )

                drawPolygon(
                  annotationCtx,
                  points,
                  state.labelsMap[annotation.labelId].color,
                  false,
                  2
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
              {
                drawControlCircle(annotationCtx, points[0], CONTROL_POINT_CIRCLE_RADIUS)
                drawControlCircle(annotationCtx, points[1], CONTROL_POINT_CIRCLE_RADIUS)

                // Purely visual - the other 2 derived corners, from the same 2 real points.
                drawControlCircle(
                  annotationCtx,
                  { x: points[1].x, y: points[0].y },
                  CONTROL_POINT_CIRCLE_RADIUS
                )
                drawControlCircle(
                  annotationCtx,
                  { x: points[0].x, y: points[1].y },
                  CONTROL_POINT_CIRCLE_RADIUS
                )
              }
              break

            case AnnotationType.Polygon:
              {
                for (const point of points) {
                  drawControlCircle(annotationCtx, point, CONTROL_POINT_CIRCLE_RADIUS)
                }
              }
              break
          }
        }

        drawCreationPreview(annotationCtx, state, xScale, yScale)

        let hoveredAnnotation: IAnnotation | null = null
        if (state.hoveredAnnotationId !== null) {
          hoveredAnnotation =
            selectedAnnotation?.id === state.hoveredAnnotationId
              ? selectedAnnotation
              : (state.sample
                  ?.resolve()
                  .annotations.resolve()
                  [state.hoveredAnnotationId]?.resolve() ?? null)
        }

        if (state.isAnnotationsDrawerHovered) {
          dimCanvas(annotationCtx, width, height)

          if (hoveredAnnotation !== null) {
            const hoveredPoints = transformPoints(
              hoveredAnnotation.points,
              state.imageRect.x,
              state.imageRect.y,
              xScale,
              yScale
            )
            const spotlightShape =
              hoveredAnnotation.type === AnnotationType.Box
                ? getBoxPoints(hoveredPoints)
                : hoveredPoints

            cutoutShape(annotationCtx, spotlightShape)

            // Redraws the spotlighted annotation's outline undimmed, thicker than normal.
            drawPolygon(
              annotationCtx,
              spotlightShape,
              state.labelsMap[hoveredAnnotation.labelId]?.color ?? '#ffffff',
              false,
              HOVER_OUTLINE_WIDTH
            )
          }
        }

        if (state.showHitTestDebugOverlay) {
          annotationCtx.globalAlpha = HIT_TEST_OVERLAY_ALPHA
          annotationCtx.drawImage(state.hitTestCanvas, 0, 0)
          annotationCtx.globalAlpha = 1
        }
      }
    }

    const crosshairCtx = crosshairCanvasElement.getContext('2d')
    if (crosshairCtx !== null) {
      crosshairCtx.clearRect(0, 0, width, height)
      if (state.mode === LabelerMode.CreateBox || state.mode === LabelerMode.CreatePolygon) {
        drawCrosshair(crosshairCtx, state.mousePos[0], state.mousePos[1], width, height)
      }
    }
  }, [annotationCanvas, crosshairCanvas, imageCanvas, store])

  // Render-on-demand: only schedules a frame when the store has something dirty.
  useEffect(() => {
    let frameId: number | null = null

    const isDirty = () => {
      const state = store.getState()
      return state.sizeDirty || state.imageDirty || state.annotationDirty || state.hitTestDirty
    }

    const scheduleFrame = () => {
      if (frameId !== null) return
      frameId = requestAnimationFrame(() => {
        frameId = null
        drawCanvases()
        // Some modes keep marking annotationDirty on every mouse move - keep going until clean.
        if (isDirty()) {
          scheduleFrame()
        }
      })
    }

    scheduleFrame()

    const unsubscribe = store.subscribe(() => {
      if (isDirty()) {
        scheduleFrame()
      }
    })

    const imageCanvasElement = imageCanvas.current
    const resizeObserver = new ResizeObserver(() => {
      store.getState().markAllDirty()
      scheduleFrame()
    })
    if (imageCanvasElement !== null) {
      resizeObserver.observe(imageCanvasElement)
    }

    return () => {
      unsubscribe()
      resizeObserver.disconnect()
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [drawCanvases, imageCanvas, store])
}

const useHitTestDebugging = (store: UseBoundStore<StoreApi<LabelerStore>>) => {
  // global labeler commands
  useEffect(() => {
    const debugCommands: LabelerCommands = {
      enableHitTestDebug: () => {
        store.getState().setShowHitTestDebugOverlay(true)
      },
      disableHitTestDebug: () => {
        store.getState().setShowHitTestDebugOverlay(false)
      }
    }

    ;(window as Window & { labeler?: LabelerCommands }).labeler = debugCommands

    return () => {
      const runtime = window as Window & { labelerDebug?: LabelerCommands }
      if (runtime.labelerDebug === debugCommands) {
        delete runtime.labelerDebug
      }
    }
  }, [store])
}

export const Labeler = ({ store, className }: LabelerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const crosshairCanvasRef = useRef<HTMLCanvasElement>(null)
  const onContextMenu = useLabelerContextMenu(store)
  useHitTestDebugging(store)
  useCanvasDraw(store, imageCanvasRef, annotationCanvasRef, crosshairCanvasRef)
  usePointer(store, containerRef)

  return (
    <CanvasContainer
      ref={containerRef}
      className={className}
      onContextMenu={onContextMenu}
      tabIndex={0}
      data-testid="labeler-canvas"
    >
      <Canvas ref={imageCanvasRef} />
      <Canvas ref={annotationCanvasRef} />
      <CrosshairCanvas ref={crosshairCanvasRef} />
    </CanvasContainer>
  )
}

Labeler.displayName = 'Labeler'
