import { ActionIcon, Badge, Drawer, Group, Stack, Text } from '@mantine/core'
import { LabelerStore } from '@renderer/hooks/useLabeler'
import { LabelerMode } from '@renderer/types'
import { AnnotationType } from '@shared/types'
import type { FC } from 'react'
import { MdDeleteOutline } from 'react-icons/md'
import { BsBoundingBoxCircles } from 'react-icons/bs'
import { PiPolygonLight } from 'react-icons/pi'
import tinycolor from 'tinycolor2'
import { StoreApi, UseBoundStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

export type AnnotationsDrawerProps = {
  store: UseBoundStore<StoreApi<LabelerStore>>
  opened: boolean
  onClose: () => void
}

const AnnotationTypeIcon = ({ type }: { type: AnnotationType }) =>
  type === AnnotationType.Box ? <BsBoundingBoxCircles size={14} /> : <PiPolygonLight size={14} />

export const AnnotationsDrawer: FC<AnnotationsDrawerProps> = ({ store, opened, onClose }) => {
  const annotations = store(
    useShallow((s) =>
      Object.values(s.sample?.resolve().annotations.resolve() ?? {}).map((a) => a.resolve())
    )
  )
  const selectedAnnotationId = store((s) => s.selectedAnnotation?.resolve().id ?? null)
  const labelsMap = store((s) => s.labelsMap)

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
      <Stack gap="xs">
        {annotations.length === 0 && (
          <Text c="dimmed" size="sm">
            No annotations yet
          </Text>
        )}
        {annotations.map((annotation) => {
          const label = labelsMap[annotation.labelId]
          const selected = annotation.id === selectedAnnotationId

          return (
            <Group
              key={annotation.id}
              justify="space-between"
              wrap="nowrap"
              p="xs"
              style={{
                cursor: 'pointer',
                borderRadius: 'var(--mantine-radius-sm)',
                backgroundColor: selected
                  ? 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))'
                  : undefined
              }}
              onClick={() => {
                const state = store.getState()
                if (state.mode !== LabelerMode.Select) {
                  state.setMode(LabelerMode.Select)
                }
                state.selectAnnotation(annotation.id)
              }}
            >
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
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
                <AnnotationTypeIcon type={annotation.type} />
                <Text size="sm" truncate>
                  {label?.name ?? 'Unknown label'}
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
            </Group>
          )
        })}
      </Stack>
    </Drawer>
  )
}
