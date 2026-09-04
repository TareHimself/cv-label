# CV-Label Archive Format (`.cvlabel`)

Version: 1

## 1. Overview

A `.cvlabel` file is this app's native interchange format: a zip archive containing one
`manifest.json` plus the sample images it references. One shape covers both use cases:

- Exporting a selection of tasks (task structure and names preserved).
- Exporting a whole project (same shape - just every task in the project).

What differs is *import intent*, chosen by the user at import time, not anything in the file
itself: import into the current project (merge every task's samples into one, or keep them
separate, plus a label-mapping step) or create a brand-new project from the file (no merging, no
label mapping).

## 2. File layout

```
manifest.json
images/<sampleId>.<ext>
```

`imageFile` paths inside the manifest are relative to the archive root (wherever `manifest.json`
sits, which is always the root today).

## 3. `manifest.json`

| Field     | Type       | Description |
| --------- | ---------- | ----------- |
| `version` | `number`   | Format version. Currently always `1`. |
| `labels`  | `Label[]`  | Every exported label |
| `tasks`   | `Task[]`   | Every exported task, each carrying its own samples directly |

### Label

| Field   | Type     |
| ------- | -------- |
| `id`    | `string` |
| `name`  | `string` |
| `color` | `string` |

### Task

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
| `completedAt` | `string \| null`  | ISO 8601, or `null` if not marked complete |
| `imageFile`   | `string`          | Path relative to `manifest.json`, e.g. `images/abc123.jpg` |
| `annotations` | `Annotation[]`    | |
| `width`, `height` | `number` (optional) | Written on export; not read on import today |

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

**Into the current project**: a manifest's `labels` are independent of any project's existing
labels. Importing asks the user to map each manifest label id to a project label (or drop it);
annotations whose label has no mapping are dropped. If the archive has more than one task, the
user also chooses whether to merge every task's samples into one, or import them as separate
tasks. Every id (sample, annotation, point, and task if kept separate) is regenerated fresh, so
manifest ids only need to be unique within the file, not globally.

**As a new project**: always creates a brand-new project (named by the user, not read from the
file), with its own fresh labels and every task reconstructed directly from `tasks`/`labels` as
exported — no label mapping step, since there's no existing project to reconcile against, and no
id-based sample-to-task lookup either, since each task already carries its own samples. Every id
is likewise regenerated. `Label.color` is kept as exported (falls back to a random color if
missing); `Sample.completedAt` is kept as exported either way.

## 5. Versioning

`version` is required on every manifest starting at format version 1; there is no support for
manifests written before this field existed. A parser should still ignore any *unknown field* it
doesn't recognize rather than reject the manifest — forward compatibility is about tolerating
additions, not about reading old files. Bump `version` on any future breaking change.

## 6. Example

```json
{
  "version": 1,
  "labels": [{ "id": "lbl_1", "name": "person", "color": "#ff0000" }],
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
          "completedAt": null,
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
