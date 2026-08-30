# CV-Label Archive Format (`.cvlabel`)

Version: unversioned (see [§5](#5-versioning))

## 1. Overview

A `.cvlabel` file is this app's native interchange format: a zip archive containing one
`manifest.json` plus the sample images it references. It's flat (no task structure), so it can be
re-imported into any project via a label-mapping step.

## 2. File layout

```
manifest.json
images/<sampleId>.<ext>
```

`imageFile` paths inside the manifest are relative to the archive root (wherever `manifest.json`
sits, which is always the root today).

## 3. `manifest.json`

Top-level object:

| Field     | Type       | Description        |
| --------- | ---------- | ------------------- |
| `labels`  | `Label[]`  | Every exported label |
| `samples` | `Sample[]` | Every exported sample |

### Label

| Field  | Type     |
| ------ | -------- |
| `id`   | `string` |
| `name` | `string` |

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

### Annotation

| Field     | Type                  | Description |
| --------- | --------------------- | ----------- |
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

## 4. Label mapping on import

A manifest's `labels` list is independent of any project's existing labels. Importing asks the
user to map each manifest label id to a project label (or drop it); annotations whose label has
no mapping are dropped. Every id (sample, annotation, point) is regenerated fresh on import, so
manifest ids only need to be unique within the file, not globally.

## 5. Versioning

There is no `version` field today. A parser should ignore unknown fields rather than reject them —
the reference importer only reads `id`, `name`, `split`, `createdAt`, `imageFile` and `annotations`
off each `Sample`. Any breaking change to this format should add an explicit top-level `version`
field before external tooling should rely on it.

## 6. Example

```json
{
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

See [`schema.json`](./schema.json) for a machine-checkable JSON Schema of `manifest.json`.
