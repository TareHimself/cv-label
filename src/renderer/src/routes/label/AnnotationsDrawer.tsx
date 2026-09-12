import {
  ActionIcon,
  Badge,
  Checkbox,
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
import { MdChevronRight, MdClose, MdContentCopy, MdDeleteOutline } from 'react-icons/md'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { PiPolygonLight } from 'react-icons/pi'
import tinycolor from 'tinycolor2'
import { StoreApi, UseBoundStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

// Same hover convention as BasicListPageItem's Row - a stronger swap layered on the selected row so it still visibly reacts to hover.
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

/** Groups annotations whose label was since deleted - kept visible under their own group rather than dropped. */
const UNKNOWN_LABEL_GROUP = '__unknown__'

/** Buckets annotations by label id, preserving each group's first-occurrence order. */
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

/** Selection only ever makes sense in Select mode - same guard the row click has always used. */
const ensureSelectMode = (store: UseBoundStore<StoreApi<LabelerStore>>) => {
  const state = store.getState()
  if (state.mode !== LabelerMode.Select) {
    state.setMode(LabelerMode.Select)
  }
}

type TriState = 'none' | 'some' | 'all'

const triStateOf = (ids: string[], selected: Set<string>): TriState => {
  const selectedCount = ids.filter((id) => selected.has(id)).length
  if (selectedCount === 0) return 'none'
  return selectedCount === ids.length ? 'all' : 'some'
}

type SelectionHeaderProps = {
  allState: TriState
  selectedCount: number
  onToggleAll: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClear: () => void
}

/**
 * One row, always mounted whenever there's at least one annotation - its contents swap in place
 * (label text, icon visibility) instead of the batch bar mounting/unmounting, so selecting
 * doesn't shift the list below it.
 */
const SelectionHeader: FC<SelectionHeaderProps> = ({
  allState,
  selectedCount,
  onToggleAll,
  onDuplicate,
  onDelete,
  onClear
}) => (
  <Group justify="space-between" wrap="nowrap" p="xs">
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      <Checkbox
        size="xs"
        aria-label="Select all annotations"
        checked={allState === 'all'}
        indeterminate={allState === 'some'}
        onChange={onToggleAll}
      />
      <Text size="xs" c="dimmed" truncate>
        {selectedCount > 0 ? `${selectedCount} selected` : 'Select All'}
      </Text>
    </Group>
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        aria-label="Duplicate selected annotations"
        variant="subtle"
        disabled={selectedCount < 2}
        style={{ visibility: selectedCount < 2 ? 'hidden' : 'visible' }}
        onClick={onDuplicate}
      >
        <MdContentCopy size={16} />
      </ActionIcon>
      <ActionIcon
        aria-label="Delete selected annotations"
        variant="subtle"
        color="red"
        disabled={selectedCount < 2}
        style={{ visibility: selectedCount < 2 ? 'hidden' : 'visible' }}
        onClick={onDelete}
      >
        <MdDeleteOutline size={16} />
      </ActionIcon>
      <ActionIcon
        aria-label="Clear selection"
        variant="subtle"
        disabled={selectedCount === 0}
        style={{ visibility: selectedCount === 0 ? 'hidden' : 'visible' }}
        onClick={onClear}
      >
        <MdClose size={16} />
      </ActionIcon>
    </Group>
  </Group>
)

export const AnnotationsDrawer: FC<AnnotationsDrawerProps> = ({ store, opened, onClose }) => {
  const annotations = store(
    useShallow((s) =>
      Object.values(s.sample?.resolve().annotations.resolve() ?? {}).map((a) => a.resolve())
    )
  )
  const selectedAnnotationIds = store((s) => s.selectedAnnotationIds)
  const labelsMap = store((s) => s.labelsMap)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Closing the drawer doesn't fire a mouseleave on whatever was hovered - clear the dim explicitly so it doesn't linger.
  useEffect(() => {
    if (!opened) {
      store.getState().setAnnotationsDrawerHovered(false)
    }
  }, [opened, store])

  // Same idea for leaving the Labeler page entirely while the drawer was open.
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
        {annotations.length > 0 &&
          (() => {
            const allIds = annotations.map((a) => a.id)
            const allState = triStateOf(allIds, selectedAnnotationIds)
            return (
              <SelectionHeader
                allState={allState}
                selectedCount={selectedAnnotationIds.size}
                onToggleAll={() => {
                  ensureSelectMode(store)
                  store.getState().setSelectedAnnotationIds(allState === 'all' ? [] : allIds)
                }}
                onDuplicate={() => {
                  ensureSelectMode(store)
                  store.getState().duplicateSelectedAnnotation()
                }}
                onDelete={() => store.getState().deleteSelectedAnnotation()}
                onClear={() => store.getState().selectAnnotation(null)}
              />
            )
          })()}
        {Array.from(groupByLabel(annotations)).map(([groupKey, groupAnnotations]) => {
          const label = groupKey === UNKNOWN_LABEL_GROUP ? undefined : labelsMap[groupKey]
          const isOpen = !collapsedGroups.has(groupKey)
          const groupName = label?.name ?? 'Unknown label'
          const groupIds = groupAnnotations.map((a) => a.id)
          const groupState = triStateOf(groupIds, selectedAnnotationIds)

          return (
            <Stack key={groupKey} gap={4}>
              <Group gap={6} wrap="nowrap">
                <Checkbox
                  size="xs"
                  aria-label={`Select all annotations in ${groupName}`}
                  checked={groupState === 'all'}
                  indeterminate={groupState === 'some'}
                  onChange={() => {
                    ensureSelectMode(store)
                    const next = new Set(store.getState().selectedAnnotationIds)
                    for (const id of groupIds) {
                      if (groupState === 'all') next.delete(id)
                      else next.add(id)
                    }
                    store.getState().setSelectedAnnotationIds([...next])
                  }}
                />
                <UnstyledButton
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isOpen}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
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
              </Group>
              <Collapse in={isOpen}>
                <Stack gap="xs" pl="lg">
                  {groupAnnotations.map((annotation, index) => {
                    const selected = selectedAnnotationIds.has(annotation.id)

                    return (
                      <AnnotationRow
                        key={annotation.id}
                        justify="space-between"
                        wrap="nowrap"
                        p="xs"
                        data-selected={selected}
                        onClick={(e) => {
                          ensureSelectMode(store)
                          if (e.shiftKey) {
                            store.getState().toggleAnnotationSelection(annotation.id)
                          } else {
                            store.getState().selectAnnotation(annotation.id)
                          }
                        }}
                        onMouseEnter={() => store.getState().setHoveredAnnotation(annotation.id)}
                        onMouseLeave={() => store.getState().setHoveredAnnotation(null)}
                      >
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Checkbox
                            size="xs"
                            aria-label={`Select ${annotation.type === AnnotationType.Box ? 'Box' : 'Polygon'} ${index + 1}`}
                            checked={selected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => {
                              ensureSelectMode(store)
                              store.getState().toggleAnnotationSelection(annotation.id)
                            }}
                          />
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
