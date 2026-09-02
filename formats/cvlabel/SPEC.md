# CV-Label Archive Format (`.cvlabel`)

Version: 1

## 1. Overview

A `.cvlabel` file is this app's native interchange format: a zip archive containing one
`manifest.json` plus the sample images it references. Every manifest has a `kind`:

- **`tasks`** — a flat, project-agnostic export of one or more tasks' samples. Designed for
  merging samples into any project via a label-mapping step on import; task structure isn't
  preserved.
- **`project`** — a full snapshot of one project, task structure included, for backup/duplication.
  Import always creates a new project; there's no merge-into-an-existing-project path.

## 2. File layout

```
manifest.json
images/<sampleId>.<ext>
```

`imageFile` paths inside the manifest are relative to the archive root (wherever `manifest.json`
sits, which is always the root today).

## 3. `manifest.json`

Every manifest starts with:

| Field     | Type                 | Description |
| --------- | -------------------- | ----------- |
| `version` | `number`             | Format version. Currently always `1`. |
| `kind`    | `"tasks" \| "project"` | Which shape the rest of the manifest follows — see below. |
| `labels`  | `Label[]`             | Every exported label |

A `kind: "tasks"` manifest additionally has:

| Field     | Type       | Description |
| --------- | ---------- | ----------- |
| `samples` | `Sample[]` | A flat list, independent of any task structure |

A `kind: "project"` manifest additionally has:

| Field     | Type       | Description |
| --------- | ---------- | ----------- |
| `project` | `Project`  | The exported project's own identity |
| `tasks`   | `Task[]`   | Every task in the project, each carrying its own samples directly |

There's no top-level `samples` field for `kind: "project"` — each task nests its samples, mirroring
the app's actual Project → Task → Sample structure instead of flattening it into id references.

### Label

| Field  | Type     |
| ------ | -------- |
| `id`   | `string` |
| `name` | `string` |

### Project (`kind: "project"` only)

| Field  | Type     |
| ------ | -------- |
| `name` | `string` |

### Task (`kind: "project"` only)

| Field     | Type       | Description |
| --------- | ---------- | ----------- |
| `id`      | `string`   | |
| `name`    | `string`   | |
| `samples` | `Sample[]` | This task's own samples, nested directly - not an id reference |

### Sample

| Field         | Type              | Description |
| ------------- | ----------------- | ----------- |
| `id`          | `string`          | |
| `name`        | `string`          | |
| `split`       | `"train" \| "test" \| "valid"` | |
| `createdAt`   | `string`          | ISO 8601 |
| `imageFile`   | `string`          | Path relative to `manifest.json`, e.g. `images/abc123.jpg` |
| `annotations` | `Annotation[]`    | |
| `width`, `height` | `number` (optional) | Written on export; not read on import today |

A `kind: "tasks"` sample sits in the top-level flat `samples` list, belonging to no particular task
- that's the point of the shape. A `kind: "project"` sample sits inside whichever `Task.samples` it
belongs to - task membership is structural, not an id reference.

### Annotation

| Field     | Type                  | Description |
| --------- | ---------------------- | ----------- |
| `id`      | `string`              | |
| `type`    | `"box" \| "polygon"`  | |
| `labelId` | `string`              | References a `Label.id` in the same manifest |
| `points`  | `Point[]`             | See below |

- **`box`** — exactly 2 points: any two opposite corners of an axis-aligned rectangle (not
  required to be top-left/bottom-right; consumers should take min/max of both).
- **`polygon`** — 3+ points, the ordered outline vertices.

### Point

| Field | Type     | Description |
| ----- | -------- | ----------- |
| `id`  | `string` | |
| `x`   | `number` | Absolute pixel coordinate in the source image (not normalized 0–1) |
| `y`   | `number` | Absolute pixel coordinate in the source image (not normalized 0–1) |

## 4. Importing

**`kind: "tasks"`**: a manifest's `labels` are independent of any project's existing labels.
Importing asks the user to map each manifest label id to a project label (or drop it); annotations
whose label has no mapping are dropped. Every id (sample, annotation, point) is regenerated fresh
on import, so manifest ids only need to be unique within the file, not globally.

**`kind: "project"`**: always creates a brand-new project named after `Project.name`, with its own
fresh labels and tasks reconstructed directly from `tasks`/`labels` as exported — no label mapping
step, since there's no existing project to reconcile against, and no id-based sample-to-task lookup
either, since each task already carries its own samples. Every id is likewise regenerated.

## 5. Versioning

`version` is required on every manifest starting at format version 1; there is no support for
manifests written before this field existed. A parser should still ignore any *unknown field* it
doesn't recognize rather than reject the manifest — forward compatibility is about tolerating
additions, not about reading old files. Bump `version` on any future breaking change.

## 6. Examples

### `kind: "tasks"`

```json
{
  "version": 1,
  "kind": "tasks",
  "labels": [{ "id": "lbl_1", "name": "person" }],
  "samples": [
    {
      "id": "smp_1",
      "name": "frame_0001",
      "split": "train",
      "createdAt": "2026-08-01T12:00:00.000Z",
      "imageFile": "images/smp_1.jpg",
      "width": 1920,
      "height": 1080,
      "annotations": [
        {
          "id": "ann_1",
          "type": "box",
          "labelId": "lbl_1",
          "points": [
            { "id": "pt_1", "x": 100, "y": 200 },
            { "id": "pt_2", "x": 300, "y": 400 }
          ]
        }
      ]
    }
  ]
}
```

### `kind: "project"`

```json
{
  "version": 1,
  "kind": "project",
  "project": { "name": "Street Signs" },
  "labels": [{ "id": "lbl_1", "name": "stop_sign" }],
  "tasks": [
    {
      "id": "task_1",
      "name": "Batch 1",
      "samples": [
        {
          "id": "smp_1",
          "name": "frame_0001",
          "split": "train",
          "createdAt": "2026-08-01T12:00:00.000Z",
          "imageFile": "images/smp_1.jpg",
          "width": 1920,
          "height": 1080,
          "annotations": [
            {
              "id": "ann_1",
              "type": "box",
              "labelId": "lbl_1",
              "points": [
                { "id": "pt_1", "x": 100, "y": 200 },
                { "id": "pt_2", "x": 300, "y": 400 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

See [`schema.json`](./schema.json) for a machine-checkable JSON Schema of `manifest.json`.
