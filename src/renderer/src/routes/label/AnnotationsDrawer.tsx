import {
  ActionIcon,
  Badge,
  Collapse,
  Drawer,
  Group,
  Stack,
  Text,
  UnstyledButton
} from '@mantine/core'
import { styled } from '@linaria/react'
import { LabelerStore } from '@renderer/hooks/useLabeler'
import { useOnRouteLeave } from '@renderer/router/appRouter'
import { LabelerMode } from '@renderer/types'
import { AnnotationType, IAnnotation } from '@shared/types'
import { useEffect, useState, type FC } from 'react'
import { MdChevronRight, MdDeleteOutline } from 'react-icons/md'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { PiPolygonLight } from 'react-icons/pi'
import tinycolor from 'tinycolor2'
import { StoreApi, UseBoundStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// Same hover-affordance convention as BasicListPageItem's Row: a plain background swap
// on hover, layered with a stronger one for the selected row so hovering an
// already-selected row still visibly reacts instead of looking inert.
const AnnotationRow = styled(Group)`
  cursor: pointer;
  border-radius: var(--mantine-radius-sm);
  transition: background-color 0.1s ease;

  &:hover {
    background-color: light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6));
  }

  &[data-selected='true'] {
    background-color: light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5));
  }

  &[data-selected='true']:hover {
    background-color: light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4));
  }
`

export type AnnotationsDrawerProps = {
  store: UseBoundStore<StoreApi<LabelerStore>>
  opened: boolean
  onClose: () => void
}

const AnnotationTypeIcon = ({ type }: { type: AnnotationType }) =>
  type === AnnotationType.Box ? <BsBoundingBoxCircles size={14} /> : <PiPolygonLight size={14} />

/** Groups annotations that don't resolve to a project label (e.g. the label was since
 *  deleted) - kept visible under their own group rather than dropped. */
const UNKNOWN_LABEL_GROUP = '__unknown__'

/** Buckets annotations by label id, preserving each group's first-occurrence order in
 *  the underlying annotation list. */
const groupByLabel = (annotations: IAnnotation[]): Map<string, IAnnotation[]> => {
  const groups = new Map<string, IAnnotation[]>()
  for (const annotation of annotations) {
    const key = annotation.labelId || UNKNOWN_LABEL_GROUP
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(annotation)
    } else {
      groups.set(key, [annotation])
    }
  }
  return groups
}

export const AnnotationsDrawer: FC<AnnotationsDrawerProps> = ({ store, opened, onClose }) => {
  const annotations = store(
    useShallow((s) =>
      Object.values(s.sample?.resolve().annotations.resolve() ?? {}).map((a) => a.resolve())
    )
  )
  const selectedAnnotationId = store((s) => s.selectedAnnotation?.resolve().id ?? null)
  const labelsMap = store((s) => s.labelsMap)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Closing the drawer doesn't naturally fire a mouseleave on whatever was hovered when
  // it closed - clear the canvas dim/spotlight explicitly so it doesn't linger.
  useEffect(() => {
    if (!opened) {
      store.getState().setAnnotationsDrawerHovered(false)
    }
  }, [opened, store])

  // Same idea for leaving the Labeler page entirely while the drawer happened to be open -
  // that also doesn't fire a mouseleave, and Activity would otherwise preserve the dim
  // state until the user's mouse re-triggers it on return.
  useOnRouteLeave(() => store.getState().setAnnotationsDrawerHovered(false))

  const toggleGroup = (key: string) =>
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      withOverlay={false}
      trapFocus={false}
      closeOnClickOutside={false}
      title="Annotations"
    >
      <Stack
        gap="xs"
        data-testid="annotations-drawer-content"
        onMouseEnter={() => store.getState().setAnnotationsDrawerHovered(true)}
        onMouseLeave={() => store.getState().setAnnotationsDrawerHovered(false)}
      >
        {annotations.length === 0 && (
          <Text c="dimmed" size="sm">
            No annotations yet
          </Text>
        )}
        {Array.from(groupByLabel(annotations)).map(([groupKey, groupAnnotations]) => {
          const label = groupKey === UNKNOWN_LABEL_GROUP ? undefined : labelsMap[groupKey]
          const isOpen = !collapsedGroups.has(groupKey)
          const groupName = label?.name ?? 'Unknown label'

          return (
            <Stack key={groupKey} gap={4}>
              <UnstyledButton
                onClick={() => toggleGroup(groupKey)}
                aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <MdChevronRight
                  size={16}
                  style={{
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.1s ease'
                  }}
                />
                {label && (
                  <Badge
                    size="xs"
                    circle
                    style={{
                      backgroundColor: label.color,
                      color: tinycolor(label.color).isLight() ? '#000' : '#fff',
                      flexShrink: 0
                    }}
                  />
                )}
                <Text size="sm" fw={500} truncate style={{ flex: 1, textAlign: 'left' }}>
                  {groupName}
                </Text>
                <Text size="xs" c="dimmed">
                  {groupAnnotations.length}
                </Text>
              </UnstyledButton>
              <Collapse in={isOpen}>
                <Stack gap="xs" pl="lg">
                  {groupAnnotations.map((annotation, index) => {
                    const selected = annotation.id === selectedAnnotationId

                    return (
                      <AnnotationRow
                        key={annotation.id}
                        justify="space-between"
                        wrap="nowrap"
                        p="xs"
                        data-selected={selected}
                        onClick={() => {
                          const state = store.getState()
                          if (state.mode !== LabelerMode.Select) {
                            state.setMode(LabelerMode.Select)
                          }
                          state.selectAnnotation(annotation.id)
                        }}
                        onMouseEnter={() => store.getState().setHoveredAnnotation(annotation.id)}
                        onMouseLeave={() => store.getState().setHoveredAnnotation(null)}
                      >
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <AnnotationTypeIcon type={annotation.type} />
                          <Text size="sm" truncate>
                            {annotation.type === AnnotationType.Box ? 'Box' : 'Polygon'} {index + 1}
                          </Text>
                        </Group>
                        <ActionIcon
                          aria-label="Delete annotation"
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation()
                            store.getState().deleteAnnotation(annotation.id)
                          }}
                        >
                          <MdDeleteOutline size={16} />
                        </ActionIcon>
                      </AnnotationRow>
                    )
                  })}
                </Stack>
              </Collapse>
            </Stack>
          )
        })}
      </Stack>
    </Drawer>
  )
}
